import { createThirdwebClient } from "thirdweb";
import { deployERC20Contract } from "thirdweb/deploys";
import { base } from "thirdweb/chains";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";

const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";

// 1. Inizializza il client thirdweb con la Secret Key
const client = createThirdwebClient({
  secretKey: SECRET_KEY,
});

async function runDeploy() {
  console.log("-------------------------------------------------------");
  console.log("Connessione a Base Mainnet tramite Thirdweb Paymaster...");
  console.log("-------------------------------------------------------");

  // 2. Chiave di firma locale (usata unicamente per firmare la UserOp)
  const personalAccount = privateKeyToAccount({
    client,
    privateKey: process.env.DEPLOYER_PRIVATE_KEY || "0x0123456789012345678901234567890123456789012345678901234567890123",
  });

  // 3. Smart Wallet ERC-4337 su Base Mainnet con Gas Sponsorship attivo
  const adminWallet = smartWallet({
    chain: base,
    sponsorGas: true,
  });

  console.log("Connessione dello Smart Account ERC-4337...");
  const smartAccount = await adminWallet.connect({
    client,
    personalAccount,
  });

  console.log("Smart Account indirizzo:", smartAccount.address);
  console.log("Invio transazione di deploy con Paymaster sponsorizzato...");

  // 4. Deploy del contratto ERC-20 tramite factory pre-costruita
  const contractAddress = await deployERC20Contract({
    client,
    chain: base,
    account: smartAccount,
    type: "TokenERC20",
    params: {
      name: "Platform Utility Token",
      symbol: "PUT",
      primary_sale_recipient: smartAccount.address,
    },
  });

  console.log("=======================================================");
  console.log("DEPLOY COMPLETATO CON SUCCESSO SU BASE MAINNET!");
  console.log("Indirizzo Contratto:", contractAddress);
  console.log("Explorer BaseScan: https://basescan.org/address/" + contractAddress);
  console.log("=======================================================");
}

runDeploy().catch((err) => {
  console.error("Errore durante il deploy:", err);
});
