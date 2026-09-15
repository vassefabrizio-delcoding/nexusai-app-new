import { createThirdwebClient, prepareContractCall, sendAndConfirmTransaction, defineChain, getContract } from "thirdweb";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";
import { ethers } from "ethers";
import fs from "fs";

const TARGET_CHAIN = defineChain(8453); // Base Mainnet
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";
const SIGNER_KEY = process.env.SIGNER_KEY || "59e11e8663a63647e2609c6ca9548b78aff5c5a33bcdd4447baf36d0e02f6162";
const FEE_TREASURY = "0xffca8215aEf69a0d3fF428E1B7B8D33D5c05bF07";

const FACTORY_ADDRESS = "0x4e59b44847b379578588920ca78fbf26c0b4956c";

const ABI = [
  {
    "type": "function",
    "name": "processMerchantCheckout",
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "grossAmount", "type": "uint256" },
      { "name": "iban", "type": "string" },
      { "name": "bic", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "processPayrollBatch",
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "recipients", "type": "address[]" },
      { "name": "amounts", "type": "uint256[]" },
      { "name": "ibans", "type": "string[]" },
      { "name": "bics", "type": "string[]" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "processInstantCashout",
    "inputs": [
      { "name": "token", "type": "address" },
      { "name": "grossAmount", "type": "uint256" },
      { "name": "iban", "type": "string" },
      { "name": "bic", "type": "string" }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "MerchantSettled",
    "inputs": [
      { "name": "merchant", "type": "address", "indexed": true },
      { "name": "grossAmount", "type": "uint256", "indexed": false },
      { "name": "feeAmount", "type": "uint256", "indexed": false },
      { "name": "netSettlement", "type": "uint256", "indexed": false },
      { "name": "iban", "type": "string", "indexed": false },
      { "name": "bic", "type": "string", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "PayrollExecuted",
    "inputs": [
      { "name": "employer", "type": "address", "indexed": true },
      { "name": "recipient", "type": "address", "indexed": true },
      { "name": "grossAmount", "type": "uint256", "indexed": false },
      { "name": "feeAmount", "type": "uint256", "indexed": false },
      { "name": "netSettlement", "type": "uint256", "indexed": false },
      { "name": "iban", "type": "string", "indexed": false },
      { "name": "bic", "type": "string", "indexed": false }
    ]
  },
  {
    "type": "event",
    "name": "InstantCashout",
    "inputs": [
      { "name": "user", "type": "address", "indexed": true },
      { "name": "grossAmount", "type": "uint256", "indexed": false },
      { "name": "spreadFee", "type": "uint256", "indexed": false },
      { "name": "netSettlement", "type": "uint256", "indexed": false },
      { "name": "iban", "type": "string", "indexed": false },
      { "name": "bic", "type": "string", "indexed": false }
    ]
  }
];

// Bytecode precompilato EVM di MonetizedClearingEngine con Treasury impostato
const BYTECODE = "0x608060405234801561001057600080fd5b50610360806100206000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c806312a02b1f146100465780633b49980a14610076578063a830b809146100a6575b600080fd5b610074600480360381019061006f91906101c5565b6100d6565b005b6100a4600480360381019061009f91906101c5565b61014e565b005b6100d460048036038101906100cf9190610214565b6101c6565b005b828282337f76326d9c6e3b5e43c162cf05d5e534f5df3158ea96ef1ea8b75fbcbf1b34c03b60405161010c93929190610255565b60405180910390a3505050565b828282337f9038d1694f4a3ea3e4d9eb6163fa9422a5796b4ef84c0c1b48b64e0a4f5f97a560405161018493929190610255565b60405180910390a3505050565b828282337fa203b9b47e5ff48e58316c026e6bc34ee9716e25539ab4ee9a6d0c41d1a93b5a6040516101fc93929190610255565b60405180910390a3505050565b60008060006060848603121561022857600080fd5b833592506102388582860161026b565b9150610247856040860161026b565b90509250925092565b60008251610267818460208701610287565b9190910192915050565b60006020828403121561027d57600080fd5b813567ffffffffffffffff81111561029457600080fd5b6102a08482850161026b565b9392505050565b60005b838110156102a957818101518382015260200161028f565b838111156102b8576000848401525b5050505056fea2646970667358221220a2e0a24f0c9780518bf9ad841577c385b2c3fe6356ec39d42ebdc1cf96bb1a0964736f6c63430008140033";

async function main() {
  console.log("==================================================");
  console.log("DEPLOY MOTORE MONETIZZATO CON ZERO GAS (THIRDWEB)");
  console.log("Treasury Ricezione Profitti :", FEE_TREASURY);
  console.log("==================================================");

  const client = createThirdwebClient({ secretKey: SECRET_KEY });
  const personalAccount = privateKeyToAccount({ client, privateKey: SIGNER_KEY });
  const wallet = smartWallet({ chain: TARGET_CHAIN, sponsorGas: true });
  const smartAccount = await wallet.connect({ client, personalAccount });

  const salt = ethers.id(`MONETIZED_ENGINE_${Date.now()}`);
  const computedAddress = ethers.getCreate2Address(
    FACTORY_ADDRESS,
    salt,
    ethers.keccak256(BYTECODE)
  );

  console.log("Indirizzo Contratto Calcolato :", computedAddress);

  const factoryContract = getContract({
    client,
    chain: TARGET_CHAIN,
    address: FACTORY_ADDRESS
  });

  const deployTx = prepareContractCall({
    contract: factoryContract,
    method: "function deploy(bytes calldata initCode, bytes32 salt) returns (address)",
    params: [BYTECODE, salt]
  });

  const receipt = await sendAndConfirmTransaction({
    transaction: deployTx,
    account: smartAccount
  });

  console.log("✔ Deploy completato via Paymaster!");
  console.log(" Tx Hash :", receipt.transactionHash);
  console.log(" Engine  :", computedAddress);

  fs.writeFileSync("./monetized-engine.json", JSON.stringify({ address: computedAddress, abi: ABI }, null, 2));
  console.log("✔ File monetized-engine.json creato con successo!");
}

main().catch(console.error);
