import { ethers } from "ethers";
import fs from "fs";

const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";

if (!fs.existsSync("./monetized-engine.json")) {
  console.error("❌ Esegui prima deploy-monetized-engine.mjs!");
  process.exit(1);
}

const ENGINE_CONFIG = JSON.parse(fs.readFileSync("./monetized-engine.json", "utf8"));

const TOTAL_PROFITS = {
  merchantFees: 0,
  payrollFees: 0,
  cashoutFees: 0,
  totalUsdcCollected: 0
};

function formatPacs008(txHash, amountEur, iban, bic, businessModel) {
  const msgId = `${businessModel.slice(0,3).toUpperCase()}-${Date.now()}-${txHash.slice(2, 8)}`;
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
      <IntrBkSttlmAmt Ccy="EUR">${Number(amountEur).toFixed(2)}</IntrBkSttlmAmt>
      <CdtrAgt><FinInstnId><BIC>${bic}</BIC></FinInstnId></CdtrAgt>
      <CdtrAcct><Id><IBAN>${iban}</IBAN></Id></CdtrAcct>
    </CdtTrfTxInf>
  </FIToFICstmrCdtTrf>
</Document>`;
}

async function startDaemon() {
  console.log("==================================================");
  console.log("UNIFIED FINTECH PROFIT DAEMON (SEPA + REVENUE ENGINE)");
  console.log("Engine Contract  :", ENGINE_CONFIG.address);
  console.log("Modelli Operativi: [A] Merchant  [B] Payroll  [C] Cashout");
  console.log("==================================================");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const iface = new ethers.Interface(ENGINE_CONFIG.abi);

  let lastCheckedBlock = await provider.getBlockNumber();
  console.log(`In ascolto sul blocco Base #${lastCheckedBlock}...\n`);

  setInterval(async () => {
    try {
      const currentBlock = await provider.getBlockNumber();
      if (currentBlock <= lastCheckedBlock) return;

      const logs = await provider.getLogs({
        address: ENGINE_CONFIG.address,
        fromBlock: lastCheckedBlock + 1,
        toBlock: currentBlock
      });

      for (const log of logs) {
        try {
          const parsed = iface.parseLog(log);
          const args = parsed.args;

          let modelName = "";
          let feeUsdc = 0;
          let netUsdc = 0;

          if (parsed.name === "MerchantSettled") {
            modelName = "MODELLO A (E-Commerce Merchant)";
            feeUsdc = Number(args.feeAmount) / 1e6;
            netUsdc = Number(args.netSettlement) / 1e6;
            TOTAL_PROFITS.merchantFees += feeUsdc;
          } else if (parsed.name === "PayrollExecuted") {
            modelName = "MODELLO B (B2B Web3 Payroll)";
            feeUsdc = Number(args.feeAmount) / 1e6;
            netUsdc = Number(args.netSettlement) / 1e6;
            TOTAL_PROFITS.payrollFees += feeUsdc;
          } else if (parsed.name === "InstantCashout") {
            modelName = "MODELLO C (Instant DeFi Cash-Out)";
            feeUsdc = Number(args.spreadFee) / 1e6;
            netUsdc = Number(args.netSettlement) / 1e6;
            TOTAL_PROFITS.cashoutFees += feeUsdc;
          }

          TOTAL_PROFITS.totalUsdcCollected += feeUsdc;

          console.log(`\n⚡ [LIQUIDAZIONE E REVENUE INTERCETTATI]`);
          console.log(` - Modello Business       : ${modelName}`);
          console.log(` - Transaction Hash       : ${log.transactionHash}`);
          console.log(` - IBAN Ricevente         : ${args.iban}`);
          console.log(` - BIC/SWIFT              : ${args.bic}`);
          console.log(` - Importo Netto Liquidato: ${netUsdc.toFixed(2)} USDC (~EUR)`);
          console.log(` 💰 PROFITTO TRATTENUTO   : +${feeUsdc.toFixed(2)} USDC nel Treasury`);
          console.log(` 📊 REVENUE TOTALE ATTUALE: ${TOTAL_PROFITS.totalUsdcCollected.toFixed(2)} USDC`);

          const widgetUrl = `https://widget.mtpelerin.com/?type=web&mode=sell&crys=USDC&fiat=EUR&net=base_mainnet&amount=${netUsdc.toFixed(2)}&iban=${args.iban}&bic=${args.bic}`;
          console.log(` - Deep-Link Mt Pelerin   : ${widgetUrl}`);

          const pacs = formatPacs008(log.transactionHash, netUsdc, args.iban, args.bic, parsed.name);
          console.log(`--------------------------------------------------`);
          console.log(pacs);
          console.log(`--------------------------------------------------`);
        } catch {}
      }

      lastCheckedBlock = currentBlock;
    } catch {}
  }, 2000);
}

startDaemon().catch(console.error);
