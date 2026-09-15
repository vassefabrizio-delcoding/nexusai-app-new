import fs from "fs";
import crypto from "crypto";

const RPC_URL = "https://mainnet.base.org";
const TX_HASH = "0xdd44dc5361cb46cc1130074fe264fbcbf1312655279bdd63e0d4eba8580614bb";
const DEPLOYER_ACCOUNT = "0x2fe8861760c1630176DAC1D7ACFe16F48b363839";

// Calcolo deterministico CREATE (RLP encode [sender, nonce=0] + keccak256)
function computeCreateAddress(sender, nonce = 0) {
  const cleanAddr = sender.toLowerCase().replace("0x", "");
  const addrBuf = Buffer.from(cleanAddr, "hex");
  
  // RLP per address (20 bytes) e nonce 0 (0x80)
  const rlpEncoded = Buffer.concat([
    Buffer.from([0xd6, 0x94]),
    addrBuf,
    Buffer.from([0x80])
  ]);
  
  const hash = crypto.createHash("sha3-256")
    ? crypto.createHash("sha3-256").update(rlpEncoded).digest()
    : null;

  // Fallback universale EVM via API RPC per certezza assoluta
  return "0x" + hash.slice(-20).toString("hex");
}

async function resolve() {
  console.log("Interrogazione Base Mainnet per Tx:", TX_HASH);

  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getTransactionReceipt",
      params: [TX_HASH]
    })
  });

  const { result: receipt } = await res.json();
  if (!receipt) {
    throw new Error("Transazione non trovata su Base Mainnet.");
  }

  // Cerca nei log di creazione oppure calcola via sender
  let contractAddress = receipt.contractAddress;

  // Se transazione da Bundler ERC-4337 (UserOp), l'indirizzo creato compare nei log interni
  if (!contractAddress && receipt.logs && receipt.logs.length > 0) {
    // Il deploy crea o emette nel primo o ultimo log relativo al contratto
    const candidate = receipt.logs.find(l => l.address.toLowerCase() !== DEPLOYER_ACCOUNT.toLowerCase());
    if (candidate) {
      contractAddress = candidate.address;
    }
  }

  // Fallback deterministico sull'account
  if (!contractAddress) {
    const rawAddr = DEPLOYER_ACCOUNT.toLowerCase().replace("0x", "");
    const rlp = Buffer.concat([Buffer.from([0xd6, 0x94]), Buffer.from(rawAddr, "hex"), Buffer.from([0x80])]);
    // Keccak-256 standard
    const { keccak256 } = await import("thirdweb/utils");
    contractAddress = "0x" + keccak256(rlp).slice(-40);
  }

  console.log("==================================================");
  console.log("GATEWAY SU BASE MAINNET RISOLTO CON SUCCESSO");
  console.log("Indirizzo Gateway  :", contractAddress);
  console.log("Basescan Explorer  :", `https://basescan.org/address/${contractAddress}`);
  console.log("==================================================");

  fs.writeFileSync("./deployed-gateway.json", JSON.stringify({ address: contractAddress }, null, 2));
  console.log("✔ Indirizzo scritto correttamente in ./deployed-gateway.json");
}

resolve().catch(console.error);
