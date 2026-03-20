import { Blockchain, SandboxContract, TreasuryContract } from "@ton/sandbox";
import { toNano } from "@ton/core";
import { DateEscrow } from "../build/DateEscrow/DateEscrow_DateEscrow";
import "@ton/test-utils";

describe("DateEscrow", () => {
    let blockchain: Blockchain;
    let alice: SandboxContract<TreasuryContract>;
    let bob: SandboxContract<TreasuryContract>;
    let contract: SandboxContract<DateEscrow>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        alice = await blockchain.treasury("alice");
        bob = await blockchain.treasury("bob");

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

        contract = blockchain.openContract(
            await DateEscrow.fromInit(
                alice.address,
                bob.address,
                toNano("5"),
                deadline
            )
        );

        const deployer = await blockchain.treasury("deployer");
        const deployResult = await contract.send(
            deployer.getSender(),
            { value: toNano("0.05") },
            { $$type: "Deploy", queryId: 0n }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: contract.address,
            deploy: true,
            success: true,
        });
    });

    it("état initial = OPEN", async () => {
        expect(await contract.getState()).toBe("OPEN");
        expect(await contract.getParticipantsFunded()).toBe(0n);
    });

    it("alice dépose → PARTIAL", async () => {
        await contract.send(
            alice.getSender(),
            { value: toNano("5") },
            { $$type: "Fund" }
        );
        expect(await contract.getState()).toBe("PARTIAL");
        expect(await contract.getParticipantsFunded()).toBe(1n);
    });

    it("alice + bob déposent → FUNDED", async () => {
        await contract.send(alice.getSender(), { value: toNano("5") }, { $$type: "Fund" });
        await contract.send(bob.getSender(),   { value: toNano("5") }, { $$type: "Fund" });
        expect(await contract.getState()).toBe("FUNDED");
        expect(await contract.getParticipantsFunded()).toBe(2n);
    });

    it("inconnu rejeté → exit code 401", async () => {
        const stranger = await blockchain.treasury("stranger");
        const res = await contract.send(
            stranger.getSender(),
            { value: toNano("5") },
            { $$type: "Fund" }
        );
        expect(res.transactions).toHaveTransaction({
            from: stranger.address,
            to: contract.address,
            success: false,
            exitCode: 401,
        });
    });

    it("montant insuffisant rejeté", async () => {
        const res = await contract.send(
            alice.getSender(),
            { value: toNano("1") },
            { $$type: "Fund" }
        );
        expect(res.transactions).toHaveTransaction({
            from: alice.address,
            to: contract.address,
            success: false,
        });
    });

    it("release après double confirmation → RELEASED", async () => {
        await contract.send(alice.getSender(), { value: toNano("5") },    { $$type: "Fund" });
        await contract.send(bob.getSender(),   { value: toNano("5") },    { $$type: "Fund" });
        await contract.send(alice.getSender(), { value: toNano("0.05") }, { $$type: "ConfirmRelease" });
        await contract.send(bob.getSender(),   { value: toNano("0.05") }, { $$type: "ConfirmRelease" });
        await contract.send(alice.getSender(), { value: toNano("0.05") }, "release");
        expect(await contract.getState()).toBe("RELEASED");
    });

    it("refund après deadline → REFUNDED", async () => {
        const pastDeadline = BigInt(Math.floor(Date.now() / 1000) - 10);
        const expired = blockchain.openContract(
            await DateEscrow.fromInit(alice.address, bob.address, toNano("5"), pastDeadline)
        );
        const dep = await blockchain.treasury("dep2");
        await expired.send(dep.getSender(), { value: toNano("0.05") }, { $$type: "Deploy", queryId: 0n });
        await expired.send(alice.getSender(), { value: toNano("5") }, { $$type: "Fund" });

        const res = await expired.send(
            alice.getSender(),
            { value: toNano("0.05") },
            { $$type: "Refund" }
        );
        expect(res.transactions).toHaveTransaction({ success: true });
        expect(await expired.getState()).toBe("REFUNDED");
    });
});
