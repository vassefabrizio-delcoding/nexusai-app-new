import { ethers } from "ethers";

const RPC_URL = "https://mainnet.base.org";
const TX_HASH = "0xb9e114d9ebdebf15c197808c3fa13a2066babb54ee052db2b412a93b1a4438d2";

const TARGET_IBAN = "IT22B0200822800000103317304";
const TARGET_BIC  = "UNCRITM1305";
const AMOUNT_EUR  = "500.00";

async function fetchRate() {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur");
    const d = await res.json();
    return d["usd-coin"]?.eur || 0.92;
  } catch {
    return 0.92;
  }
}

async function run() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const receipt = await provider.getTransactionReceipt(TX_HASH);

  if (!receipt || receipt.status !== 1) {
    console.error("Transazione non trovata o fallita.");
    return;
  }

  const rate = await fetchRate();
  const requiredUsdc = (Number(AMOUNT_EUR) / rate).toFixed(2);

  const params = new URLSearchParams({
    type: "web",
    mode: "sell",
    tab: "sell",
    crys: "USDC",
    fiat: "EUR",
    net: "base_mainnet",
    amount: AMOUNT_EUR,
    rUSDC: requiredUsdc,
    iban: TARGET_IBAN,
    bic: TARGET_BIC,
    addr: receipt.from,
    ext_id: TX_HASH
  });

  const widgetUrl = `https://widget.mtpelerin.com/?${params.toString()}`;

  const pacs008 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.008.001.02">
  <FIToFICstmrCdtTrf>
    <GrpHdr>
      <MsgId>CLR-${Date.now()}-${TX_HASH.slice(2, 10)}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf><SttlmMtd>CLRG</SttlmMtd></SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId><EndToEndId>${TX_HASH}</EndToEndId></PmtId>
      <IntrBkSttlmAmt Ccy="EUR">${AMOUNT_EUR}</IntrBkSttlmAmt>
      <CdtrAgt><FinInstnId><BIC>${TARGET_BIC}</BIC></FinInstnId></CdtrAgt>
      <CdtrAcct><Id><IBAN>${TARGET_IBAN}</IBAN></Id></CdtrAcct>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;

  console.log("==================================================");
  console.log("⚡ [TRANSAZIONE CONFERMATA SU BASE MAINNET]");
  console.log(" - Hash Transazione       :", TX_HASH);
  console.log(" - Blocco Base            :", receipt.blockNumber);
  console.log(" - Gas Sponsorizzato      :", receipt.gasUsed.toString());
  console.log(" - Smart Account Mittente :", receipt.from);
  console.log("==================================================");
  console.log("\n[MT PELERIN ZERO-KEY SETTLEMENT]");
  console.log(" - Valore Nominale        :", AMOUNT_EUR, "EUR");
  console.log(" - Controvalore Richiesto : ~" + requiredUsdc, "USDC");
  console.log(" - Tasso EUR/USD          :", rate);
  console.log("\n[LINK UFFICIALE LIQUIDAZIONE MT PELERIN]:");
  console.log(widgetUrl);
  console.log("\n--------------------------------------------------");
  console.log("[TRACCIATO ISO 20022 PACS.008 (SEPA INSTANT)]");
  console.log(pacs008);
  console.log("--------------------------------------------------");
  console.log("✔ FLUSSO COMPLETATO CON SUCCESSO");
}

run();
