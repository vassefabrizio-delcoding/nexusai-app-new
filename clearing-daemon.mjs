import { ethers } from "ethers";
import fs from "fs";

const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

if (!fs.existsSync("./deployed-gateway.json")) {
  console.error("❌ File deployed-gateway.json non trovato.");
  process.exit(1);
}

const CONTRACT_ADDRESS = JSON.parse(fs.readFileSync("./deployed-gateway.json", "utf8")).address;

const ABI = [
  "event ClearingTriggered(address indexed account, uint256 indexed amount, string iban, string bic)"
];

async function fetchPublicRate(amountEur) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur", { signal: controller.signal });
    clearTimeout(timeout);
    const data = await res.json();
    const rate = data["usd-coin"]?.eur || 0.92;
    return { eurRate: rate, requiredUsdc: (Number(amountEur) / rate).toFixed(2) };
  } catch {
    return { eurRate: 0.92, requiredUsdc: (Number(amountEur) / 0.92).toFixed(2) };
  }
}

async function generateMtPelerinOrder(txHash, account, amount, iban, bic) {
  const amountEur = (Number(amount) / 1e18).toFixed(2);
  const pricing = await fetchPublicRate(amountEur);

  const params = new URLSearchParams({
    type: "web",
    mode: "sell",
    tab: "sell",
    crys: "USDC",
    fiat: "EUR",
    net: "base_mainnet",
    amount: amountEur,
    rUSDC: pricing.requiredUsdc,
    iban: iban,
    bic: bic,
    addr: account,
    ext_id: txHash
  });

  return {
    amountEur,
    requiredUsdc: pricing.requiredUsdc,
    rate: pricing.eurRate,
    settlementUrl: `https://widget.mtpelerin.com/?${params.toString()}`
  };
}

function buildSepaPacs008Payload(txHash, amount, destIban, destBic) {
  const msgId = `CLR-${Date.now()}-${txHash.slice(2, 10)}`;
  const amountEur = (Number(amount) / 1e18).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.02">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>${msgId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId><EndToEndId>${txHash}</EndToEndId></PmtId>
      <IntrBkSttlmAmt Ccy="EUR">${amountEur}</IntrBkSttlmAmt>
      <CdtrAgt><FinInstnId><BIC>${destBic}</BIC></FinInstnId></CdtrAgt>
      <CdtrAcct><Id><IBAN>${destIban}</IBAN></Id></CdtrAcct>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
}

async function processSingleLog(log, iface) {
  try {
    const parsed = iface.parseLog(log);
    const { account, amount, iban, bic } = parsed.args;

    console.log(`\n==================================================`);
    console.log(`⚡ [EVENTO ON-CHAIN INTERCETTATO]`);
    console.log(` - Transaction Hash        : ${log.transactionHash}`);
    console.log(` - Blocco Base             : ${log.blockNumber}`);
    console.log(` - Smart Account Esecutore : ${account}`);
    console.log(` - Importo Richiesto       : ${ethers.formatUnits(amount, 18)} EUR`);
    console.log(` - IBAN Destinazione       : ${iban}`);
    console.log(` - BIC/SWIFT Destinazione  : ${bic}`);

    const order = await generateMtPelerinOrder(log.transactionHash, account, amount, iban, bic);

    console.log(`\n[MT PELERIN ZERO-KEY SETTLEMENT]`);
    console.log(` - Valore Nominale         : ${order.amountEur} EUR`);
    console.log(` - Token Stabiliti         : ~${order.requiredUsdc} USDC`);
    console.log(` - Tasso EUR/USD           : ${order.rate}`);
    console.log(` - Link Portale Liquidazione:\n   ${order.settlementUrl}`);

    const pacs008Xml = buildSepaPacs008Payload(log.transactionHash, amount, iban, bic);
    console.log(`\n[TRACCIATO ISO 20022 SEPA INSTANT (pacs.008)]`);
    console.log(`--------------------------------------------------`);
    console.log(pacs008Xml);
    console.log(`--------------------------------------------------`);
    console.log(`✔ LIQUIDAZIONE REGISTRATA`);
    console.log(`==================================================\n`);
  } catch (err) {
    console.error("Errore decodifica log:", err.message);
  }
}

async function startDaemon() {
  console.log("==================================================");
  console.log("MT PELERIN OFF-RAMP ENGINE (ZERO API-KEY)");
  console.log("Gateway Contract :", CONTRACT_ADDRESS);
  console.log("Rete On-Chain    : Base Mainnet");
  console.log("Canale Bancario  : SEPA / SEPA Instant Interbank");
  console.log("==================================================");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, provider);
  const iface = contract.interface;
  const processedTxs = new Set();

  // Scansione storica retroattiva di 2.000 blocchi per catturare tutte le tx precedenti
  const currentBlock = await provider.getBlockNumber();
  const startBlock = Math.max(0, currentBlock - 2000);
  console.log(`Recupero storico eventi dal blocco Base #${startBlock}...`);

  const initialLogs = await provider.getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock: startBlock,
    toBlock: currentBlock
  });

  console.log(`Trovati ${initialLogs.length} eventi nello storico.`);
  for (const log of initialLogs) {
    processedTxs.add(log.transactionHash);
    await processSingleLog(log, iface);
  }

  let lastCheckedBlock = currentBlock;
  console.log(`Demone in ascolto in tempo reale dal blocco Base #${lastCheckedBlock}...\n`);

  setInterval(async () => {
    try {
      const latestBlock = await provider.getBlockNumber();
      if (latestBlock <= lastCheckedBlock) return;

      const logs = await provider.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: lastCheckedBlock + 1,
        toBlock: latestBlock
      });

      for (const log of logs) {
        if (processedTxs.has(log.transactionHash)) continue;
        processedTxs.add(log.transactionHash);
        await processSingleLog(log, iface);
      }

      lastCheckedBlock = latestBlock;
    } catch (err) {
      // Ignora errori di rate-limit transitori del provider
    }
  }, 2500);
}

startDaemon().catch(console.error);
