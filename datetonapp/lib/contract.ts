import { TonClient, Address, toNano, beginCell } from "@ton/ton";

// TonConnect chain IDs
const CHAIN_TESTNET = "-3";

const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.RPC_API_KEY ?? "",
});

/**
 * Query the on-chain state of a DateEscrow contract.
 */
export async function getContractState(contractAddress: string) {
    const address = Address.parse(contractAddress);

    const stateResult = await client.runMethod(address, "state");
    const state = stateResult.stack.readString();

    const fundedResult = await client.runMethod(address, "participantsFunded");
    const funded = Number(fundedResult.stack.readBigNumber());

    const confirmsResult = await client.runMethod(address, "confirmationsCount");
    const confirmations = Number(confirmsResult.stack.readBigNumber());

    return { address: contractAddress, state, funded, confirmations };
}

/**
 * Build a TON Connect transaction to fund the escrow.
 * Sends the Fund message (opcode 0xA86DD47D = 2825770109).
 */
export function buildFundTransaction(contractAddress: string, amountTon: string) {
    // Normalize address to testnet-friendly format
    const addr = Address.parse(contractAddress).toString({ testOnly: true, bounceable: true });

    // Fund message body: just the opcode, no extra fields
    const body = beginCell()
        .storeUint(2825770109, 32)
        .endCell()
        .toBoc()
        .toString("base64");

    return {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: CHAIN_TESTNET,
        messages: [
            {
                address: addr,
                amount: toNano(amountTon).toString(),
                payload: body,
            },
        ],
    };
}

/**
 * Build a TON Connect transaction to confirm the date happened.
 * Sends the ConfirmRelease message (opcode 0xCC179A0D = 3424098829).
 */
export function buildConfirmTransaction(contractAddress: string) {
    const addr = Address.parse(contractAddress).toString({ testOnly: true, bounceable: true });

    const body = beginCell()
        .storeUint(3424098829, 32)
        .endCell()
        .toBoc()
        .toString("base64");

    return {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: CHAIN_TESTNET,
        messages: [
            {
                address: addr,
                amount: toNano("0.05").toString(),
                payload: body,
            },
        ],
    };
}

/**
 * Build a TON Connect transaction to request a refund after deadline.
 * Sends the Refund message (opcode 0xAD7C3ADD = 2910599901).
 */
export function buildRefundTransaction(contractAddress: string) {
    const addr = Address.parse(contractAddress).toString({ testOnly: true, bounceable: true });

    const body = beginCell()
        .storeUint(2910599901, 32)
        .endCell()
        .toBoc()
        .toString("base64");

    return {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        network: CHAIN_TESTNET,
        messages: [
            {
                address: addr,
                amount: toNano("0.05").toString(),
                payload: body,
            },
        ],
    };
}

/**
 * Check if a contract is deployed and active on-chain.
 */
export async function contractExists(contractAddress: string): Promise<boolean> {
    try {
        const address = Address.parse(contractAddress);
        const state = await client.getContractState(address);
        return state.state === "active";
    } catch {
        return false;
    }
}
