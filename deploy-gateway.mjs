import { createThirdwebClient, prepareTransaction, sendAndConfirmTransaction, defineChain } from "thirdweb";
import { privateKeyToAccount, smartWallet } from "thirdweb/wallets";
import fs from "fs";

const TARGET_CHAIN = defineChain(8453); // Base Mainnet
const SECRET_KEY = process.env.THIRDWEB_SECRET_KEY || "Z5Bk-8ouqvIVbAm1BrXt4cBJuHf1GfNyuRxCltJUEkJTeL2FZ6uUUSdRf53-FNonQRuikuGV5JrZI1lo7URH8Q";
const SIGNER_KEY = process.env.SIGNER_KEY || "59e11e8663a63647e2609c6ca9548b78aff5c5a33bcdd4447baf36d0e02f6162";

// Bytecode precompilato EVM di DirectClearingGateway (Solidity 0.8.20)
// Include: creditAccount(address,uint256), executeClearing(uint256,string,string)
// ed evento ClearingTriggered(address,uint256,string,string)
const BYTECODE = "0x608060405234801561001057600080fd5b506102aa806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c806327e335271461003b578063806f9d781461006b575b600080fd5b61006960048036038101906100649190610197565b61008d565b005b61008b600480360381019061008691906101e4565b6100db565b005b6001600160a01b038216600090815260006020526040902054816100d09190610260565b6001600160a01b0383166000908152600060205260409020555050565b828282337f76326d9c6e3b5e43c162cf05d5e534f5df3158ea96ef1ea8b75fbcbf1b34c03b60405161012393929190610214565b60405180910390a3505050565b6000806040838503121561014557600080fd5b82356001600160a01b038116811461015c57600080fd5b946020939093013593505050565b60006020828403121561017b57600080fd5b813567ffffffffffffffff81111561019257600080fd5b61019e84828501610167565b9392505050565b6000806000606084860312156101ac57600080fd5b833592506101bc85828601610167565b91506101cb8560408601610167565b90509250925092565b600082516101f6818460208701610237565b9190910192915050565b60006040518084019050602083825261021d8383866101e4565b915061022c8382856101e4565b90509392505050565b60005b8381101561025557818101518382015260200161023b565b83811115610264576000848401525b50505050565b8082018082111561027957634e487b7160e01b600052601160045260246000fd5b9291505056fea2646970667358221220a2e0a24f0c9780518bf9ad841577c385b2c3fe6356ec39d42ebdc1cf96bb1a0964736f6c63430008140033";

async function deploy() {
  console.log("==================================================");
  console.log("DEPLOY GATEWAY VIA THIRDWEB GASLESS PAYMASTER");
  console.log("==================================================");

  const client = createThirdwebClient({ secretKey: SECRET_KEY });
  const personalAccount = privateKeyToAccount({ client, privateKey: SIGNER_KEY });

  const wallet = smartWallet({
    chain: TARGET_CHAIN,
    sponsorGas: true,
  });

  const smartAccount = await wallet.connect({ client, personalAccount });
  console.log("Smart Account Deployer :", smartAccount.address);
  console.log("EOA Firmatario         :", personalAccount.address);

  console.log("\nInvio UserOperation di creazione contratto (Gasless)...");
  const deployTx = prepareTransaction({
    chain: TARGET_CHAIN,
    client,
    data: BYTECODE
  });

  const receipt = await sendAndConfirmTransaction({
    transaction: deployTx,
    account: smartAccount
  });

  const contractAddress = receipt.contractAddress;
  console.log("\n✔ Gateway deployato con successo via Paymaster!");
  console.log("Indirizzo Contratto :", contractAddress);
  console.log("Tx Hash Deploy      :", receipt.transactionHash);

  fs.writeFileSync("./deployed-gateway.json", JSON.stringify({ address: contractAddress }, null, 2));
  console.log("Indirizzo salvato in ./deployed-gateway.json");
}

deploy().catch(console.error);
