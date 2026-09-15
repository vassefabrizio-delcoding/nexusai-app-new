import React from "react";
import { createThirdwebClient } from "thirdweb";
import { base, ethereum, arbitrum } from "thirdweb/chains";
import { inAppWallet } from "thirdweb/wallets";
import { ConnectButton, PayEmbed } from "thirdweb/react";

const client = createThirdwebClient({
  clientId: import.meta.env.VITE_THIRDWEB_CLIENT_ID,
});

export default function App() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "900px", margin: "0 auto" }}>
      <h2>thirdweb Universal Bridge & Pay Portal</h2>
      <p>Converti token, effettua cross-chain swap o attiva l'on/off-ramp fiat con liquidità gestita.</p>

      {/* Connessione Smart Account con Paymaster attivo */}
      <ConnectButton
        client={client}
        chain={base}
        accountAbstraction={{
          chain: base,
          sponsorGas: true,
        }}
        wallets={[
          inAppWallet({
            auth: {
              options: ["email", "google", "passkey"],
            },
          }),
        ]}
      />

      <div style={{ marginTop: "30px", display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
        {/* Componente PayEmbed: Swap, Bridge e Fiat Gateway unificati */}
        <PayEmbed
          client={client}
          payOptions={{
            mode: "direct_payment",
            // Asset di destinazione predefinito (es. USDC su Base)
            buyWithCrypto: {
              testMode: false,
            },
            buyWithFiat: {
              testMode: false,
            },
            // Configurazione Revenue Sharing: prelievo commissioni di protocollo
            feeRecipient: "0xffca8215aEf69a0d3fF428E1B7B8D33D5c05bF07",
            sellerFeeBasisPoints: 100, // 1% di fee su ogni transazione
            prefillBuy: {
              chain: base,
              data: {
                tokenAddress: import.meta.env.VITE_CONTRACT_ADDRESS, // Il tuo token PUT
                amount: "1000",
              },
            },
          }}
        />
      </div>
    </div>
  );
}
