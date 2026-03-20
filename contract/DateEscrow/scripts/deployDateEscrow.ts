import { toNano, Address } from "@ton/core";
import { DateEscrow } from "../build/DateEscrow/DateEscrow_DateEscrow";
import { NetworkProvider } from "@ton/blueprint";

export async function run(provider: NetworkProvider) {

    // ── Paramètres du deal ──────────────────────────────────────────────
    // Pour le testnet, mets deux adresses de test (les tiennes ou des fakes)
    const userA = Address.parse("0QDjYqv4WWvLkj6rI8u2EXzzElErNj2LvDeIy-cBOylAVJeZ");  // ← remplace
    const userB = Address.parse("0QDjYqv4WWvLkj6rI8u2EXzzElErNj2LvDeIy-cBOylAVJeZ");  // ← remplace

    const amountPerUser = toNano("0.5");  // 0.5 TON chacun pour le testnet

    // Deadline dans 24h
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

    // ── Déploiement ─────────────────────────────────────────────────────
    const dateEscrow = provider.open(
        await DateEscrow.fromInit(userA, userB, amountPerUser, deadline)
    );

    await dateEscrow.send(
        provider.sender(),
        { value: toNano("0.05") },
        { $$type: "Deploy", queryId: 0n }
    );

    await provider.waitForDeploy(dateEscrow.address);

    console.log("✅ DateEscrow déployé à l'adresse :", dateEscrow.address.toString());
}