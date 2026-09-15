import { createThirdwebClient, getContract, prepareContractCall, sendAndConfirmTransaction, defineChain } from "thirdweb";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";
import { parseUnits } from "viem";
import fs from "fs";

const TARGET_CHAIN = defineChain(8453); // Base Mainnet
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";
const SIGNER_KEY = process.env.SIGNER_KEY || "59e11e8663a63647e2609c6ca9548b78aff5c5a33bcdd4447baf36d0e02f6162";

// Parametri bancari beneficiari
const TARGET_IBAN = "IT22B0200822800000103317304";
const TARGET_BIC  = "UNCRITM1305";
const AMOUNT      = parseUnits("500", 18);

const client = createThirdwebClient({ secretKey: SECRET_KEY });
const personalAccount = privateKeyToAccount({ client, privateKey: SIGNER_KEY });

async function run() {
  console.log("==================================================");
  console.log("CONNESSIONE SMART ACCOUNT GASLESS (ERC-4337)");
  console.log("==================================================");

  const wallet = smartWallet({
    chain: TARGET_CHAIN,
    sponsorGas: true,
  });

  const smartAccount = await wallet.connect({ client, personalAccount });
  console.log("Smart Account Attivo :", smartAccount.address);
  console.log("EOA Firmatario       :", personalAccount.address);

  const GATEWAY_ABI = [
    {
      type: "function",
      name: "executeClearing",
      inputs: [
        { name: "_amount", type: "uint256" },
        { name: "_iban", type: "string" },
        { name: "_bic", type: "string" }
      ],
      outputs: [],
      stateMutability: "nonpayable"
    }
  ];

  const contractAddress = JSON.parse(fs.readFileSync("./deployed-gateway.json")).address;
  console.log("Indirizzo Gateway Target :", contractAddress);

  const gatewayContract = getContract({
    client,
    chain: TARGET_CHAIN,
    address: contractAddress,
    abi: GATEWAY_ABI
  });

  console.log("\n[1/1] Invio UserOperation executeClearing (Gasless)...");
  try {
    const clearTx = prepareContractCall({
      contract: gatewayContract,
      method: "executeClearing",
      params: [AMOUNT, TARGET_IBAN, TARGET_BIC]
    });

    const receipt = await sendAndConfirmTransaction({
      transaction: clearTx,
      account: smartAccount
    });

    console.log("✔ Transazione confermata su Base senza spendere ETH!");
    console.log(" Tx Hash :", receipt.transactionHash);
    console.log(" Explorer:", `https://basescan.org/tx/${receipt.transactionHash}`);
    console.log("\nControlla il Terminale 1 per verificare l'evento pacs.008 generato.");
  } catch (err) {
    console.error("\n❌ Errore durante l'invio:", err.message || err);
  }
}

run();
