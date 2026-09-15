import { createThirdwebClient, getContract, defineChain, prepareContractCall } from "thirdweb";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";
import { toWei } from "thirdweb/utils";

const TARGET_CHAIN = defineChain(8453); // Base Mainnet
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";
const SIGNER_KEY = process.env.DEPLOYER_PRIVATE_KEY || process.env.SIGNER_KEY || "59e11e8663a63647e2609c6ca9548b78aff5c5a33bcdd4447baf36d0e02f6162";

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "0x6442f4729Ee8c890D310EF92845d43184A12ee6a";
const ROUTER_ADDRESS = "0x2626664c2603336E57B271c5C0b26F421741e481"; // Uniswap SwapRouter02 Base

const client = createThirdwebClient({ secretKey: SECRET_KEY });

async function setupLiquidityApproval() {
  console.log("--------------------------------------------------");
  console.log("Inizializzazione Smart Account con Paymaster...");

  const personalAccount = privateKeyToAccount({
    client,
    privateKey: SIGNER_KEY,
  });

  const wallet = smartWallet({
    chain: TARGET_CHAIN,
    sponsorGas: true,
  });

  const account = await wallet.connect({ client, personalAccount });
  console.log("Smart Account collegato:", account.address);
  console.log("Token Target Address    :", CONTRACT_ADDRESS);

  const tokenContract = getContract({
    client,
    chain: TARGET_CHAIN,
    address: CONTRACT_ADDRESS,
  });

  console.log(`Invio approvazione di 1000 PUT verso Router Uniswap (${ROUTER_ADDRESS})...`);

  // Invio diretto della UserOperation ERC-4337 tramite prepareContractCall
  const tx = prepareContractCall({
    contract: tokenContract,
    method: "function approve(address spender, uint256 value) returns (bool)",
    params: [ROUTER_ADDRESS, toWei("1000")],
  });

  const receipt = await account.sendTransaction(tx);
  console.log("==================================================");
  console.log("✔ APPROVAZIONE CONFERMATA (GAS SPONSORIZZATO)!");
  console.log("TxHash:", receipt.transactionHash);
  console.log("Explorer BaseScan: https://basescan.org/tx/" + receipt.transactionHash);
  console.log("==================================================");
}

setupLiquidityApproval().catch((err) => {
  console.error("Errore approvazione:", err);
});
