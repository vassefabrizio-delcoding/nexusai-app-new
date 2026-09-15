import { createThirdwebClient, getContract, prepareContractCall, sendAndConfirmTransaction, defineChain } from "thirdweb";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";
import fs from "fs";

const TARGET_CHAIN = defineChain(8453);
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";
const SIGNER_KEY = process.env.SIGNER_KEY || "59e11e8663a63647e2609c6ca9548b78aff5c5a33bcdd4447baf36d0e02f6162";

const ENGINE_CONFIG = JSON.parse(fs.readFileSync("./monetized-engine.json", "utf8"));
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const TARGET_IBAN = "IT22B0200822800000103317304";
const TARGET_BIC  = "UNCRITM1305";

const client = createThirdwebClient({ secretKey: SECRET_KEY });
const personalAccount = privateKeyToAccount({ client, privateKey: SIGNER_KEY });

async function run() {
  console.log("==================================================");
  console.log("LANCIO DEI 3 MODELLI FINTECH CON GAS SPONSORIZZATO");
  console.log("==================================================");

  const wallet = smartWallet({ chain: TARGET_CHAIN, sponsorGas: true });
  const smartAccount = await wallet.connect({ client, personalAccount });

  const engineContract = getContract({
    client,
    chain: TARGET_CHAIN,
    address: ENGINE_CONFIG.address,
    abi: ENGINE_CONFIG.abi
  });

  // 1. Modello A: E-Commerce Merchant Checkout (100 USDC -> 1.00 USDC profitto)
  console.log("\n[1/3] Trigger Modello A: Merchant Checkout (100 USDC)...");
  try {
    const txA = prepareContractCall({
      contract: engineContract,
      method: "processMerchantCheckout",
      params: [USDC_BASE, 100000000n, TARGET_IBAN, TARGET_BIC]
    });
    const receiptA = await sendAndConfirmTransaction({ transaction: txA, account: smartAccount });
    console.log("✔ Modello A eseguito! Tx:", receiptA.transactionHash);
  } catch (err) {
    console.error("Errore Modello A:", err.message);
  }

  // 2. Modello B: Payroll Stipendio Web3 (500 USDC -> 1.50 USDC profitto)
  console.log("\n[2/3] Trigger Modello B: Payroll Web3 (500 USDC)...");
  try {
    const txB = prepareContractCall({
      contract: engineContract,
      method: "processPayrollBatch",
      params: [USDC_BASE, [personalAccount.address], [500000000n], [TARGET_IBAN], [TARGET_BIC]]
    });
    const receiptB = await sendAndConfirmTransaction({ transaction: txB, account: smartAccount });
    console.log("✔ Modello B eseguito! Tx:", receiptB.transactionHash);
  } catch (err) {
    console.error("Errore Modello B:", err.message);
  }

  // 3. Modello C: Instant Cash-Out / vIBAN (250 USDC -> 1.00 USDC profitto)
  console.log("\n[3/3] Trigger Modello C: Instant Cash-Out (250 USDC)...");
  try {
    const txC = prepareContractCall({
      contract: engineContract,
      method: "processInstantCashout",
      params: [USDC_BASE, 250000000n, TARGET_IBAN, TARGET_BIC]
    });
    const receiptC = await sendAndConfirmTransaction({ transaction: txC, account: smartAccount });
    console.log("✔ Modello C eseguito! Tx:", receiptC.transactionHash);
  } catch (err) {
    console.error("Errore Modello C:", err.message);
  }

  console.log("\nControlla il Terminale 1: vedrai la contabilità delle commissioni trattenute.");
}

run().catch(console.error);
