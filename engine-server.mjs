import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const FEE_TREASURY = process.env.FEE_TREASURY || "0xffca8215aEf69a0d3fF428E1B7B8D33D5c05bF07";

// Crea la cartella data se non esiste sul container di Render
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "ledger.json");
if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ transactions: [], metrics: { totalVolumeUsdc: 0, totalFeesEarnedUsdc: 0 } }, null, 2));
}

let CONTRACT_ADDRESS = "0x4Ca42cD403D1C871672064D72971F2A7a201AC69";
if (fs.existsSync("./monetized-engine.json")) {
  try {
    CONTRACT_ADDRESS = JSON.parse(fs.readFileSync("./monetized-engine.json", "utf8")).address;
  } catch (e) {}
}

const fastify = Fastify({ logger: false });

await fastify.register(fastifyCors, { origin: true });
await fastify.register(fastifyStatic, {
  root: path.join(__dirname, "public"),
  prefix: "/",
});

async function getLiveRate() {
  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=eur", { signal: ctrl.signal });
    clearTimeout(to);
    const d = await res.json();
    return d["usd-coin"]?.eur || 0.92;
  } catch {
    return 0.92;
  }
}

fastify.get("/api/health", async () => ({ status: "HEALTHY", network: "Base Mainnet (8453)", engineContract: CONTRACT_ADDRESS, treasury: FEE_TREASURY }));

fastify.get("/api/quote", async (req) => {
  const { amountUsdc, model } = req.query;
  const gross = parseFloat(amountUsdc) || 100;
  let fee = 0;
  if (model === "merchant") fee = gross * 0.01;
  else if (model === "payroll") fee = 1.50;
  else fee = gross * 0.004;

  const net = Math.max(0, gross - fee);
  const rate = await getLiveRate();
  const netEur = (net * rate).toFixed(2);

  return {
    grossUsdc: gross.toFixed(2),
    feeUsdc: fee.toFixed(2),
    netUsdc: net.toFixed(2),
    estimatedEur: netEur,
    rateEurPerUsdc: rate
  };
});

fastify.get("/api/metrics", async () => {
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return db.metrics;
});

fastify.post("/api/create-order", async (req, reply) => {
  const { model, amount, iban, bic, accountAddress } = req.body;
  if (!iban || !amount) return reply.status(400).send({ error: "Dati mancanti" });

  const rate = await getLiveRate();
  const grossUsdc = parseFloat(amount);
  let feeUsdc = 0;
  if (model === "merchant") feeUsdc = grossUsdc * 0.01;
  else if (model === "payroll") feeUsdc = 1.50;
  else feeUsdc = grossUsdc * 0.004;

  const netUsdc = Math.max(0, grossUsdc - feeUsdc);
  const netEur = (netUsdc * rate).toFixed(2);
  const extId = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const params = new URLSearchParams({
    type: "web",
    mode: "sell",
    tab: "sell",
    crys: "USDC",
    fiat: "EUR",
    net: "base_mainnet",
    amount: netEur,
    rUSDC: netUsdc.toFixed(2),
    iban: iban,
    bic: bic || "UNCRITM1XXX",
    addr: accountAddress || FEE_TREASURY,
    ext_id: extId
  });

  const settlementUrl = `https://widget.mtpelerin.com/?${params.toString()}`;

  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  db.transactions.unshift({
    id: extId,
    timestamp: new Date().toISOString(),
    model,
    grossUsdc,
    feeUsdc,
    netUsdc,
    netEur,
    iban,
    settlementUrl
  });
  db.metrics.totalVolumeUsdc += grossUsdc;
  db.metrics.totalFeesEarnedUsdc += feeUsdc;
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));

  return {
    orderId: extId,
    grossUsdc,
    feeRetainedUsdc: feeUsdc,
    netSettledUsdc: netUsdc,
    netFiatEur: netEur,
    settlementUrl
  };
});

async function run() {
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log("==================================================");
  console.log(`🚀 FINTECH ENTERPRISE ENGINE ATTIVO SU RENDER`);
  console.log(`🌐 Porta In Ascolto     : ${PORT}`);
  console.log(`🏦 Treasury Fee Wallet  : ${FEE_TREASURY}`);
  console.log(`⛓ Gateway On-Chain      : ${CONTRACT_ADDRESS}`);
  console.log("==================================================");
}

run().catch(console.error);
