import { TonClient, Address, toNano, beginCell, Cell } from "@ton/ton";

const client = new TonClient({
    endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
    apiKey: process.env.TONCENTER_API_KEY ?? "",
});

const STATES = ["OPEN", "PARTIAL", "FUNDED", "RELEASED", "REFUNDED"];

export async function getContractState(contractAddress: string) {
    const address = Address.parse(contractAddress);

    const [stateResult, fundedResult] = await Promise.all([
        client.runMethod(address, "getState"),
        client.runMethod(address, "getParticipantsFunded"),
    ]);

    const stateIndex = stateResult.stack.readNumber();
    const funded = fundedResult.stack.readNumber();

    return {
        address: contractAddress,
        state: STATES[stateIndex] ?? "UNKNOWN",
        funded,
    };
}

export function buildFundTransaction(contractAddress: string, amountTon: string) {
    return {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
            {
                address: contractAddress,
                amount: toNano(amountTon).toString(),
            },
        ],
    };
}

export function buildConfirmTransaction(contractAddress: string) {
    return {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [
            {
                address: contractAddress,
                amount: toNano("0.05").toString(),
            },
        ],
    };
}

export async function contractExists(contractAddress: string): Promise<boolean> {
    try {
        const address = Address.parse(contractAddress);
        const state = await client.getContractState(address);
        return state.state === "active";
    } catch {
        return false;
    }
}
