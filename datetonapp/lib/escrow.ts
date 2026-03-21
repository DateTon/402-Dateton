import { TonClient, WalletContractV4, internal, toNano, Address, SendMode } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { DateEscrow } from './DateEscrow';

/**
 * Deploy a new DateEscrow contract from the server (facilitator wallet).
 *
 * Requires env vars:
 *   WALLET_MNEMONIC  — 24-word mnemonic for the facilitator wallet
 *   TON_RPC_URL      — e.g. https://testnet.toncenter.com/api/v2/jsonRPC
 *   RPC_API_KEY      — TonCenter API key
 */
export async function deployEscrowContract(params: {
    wallet1: string;
    wallet2: string;
    amountTon: number;
}): Promise<string> {
    const mnemonic = process.env.WALLET_MNEMONIC;
    if (!mnemonic) throw new Error('WALLET_MNEMONIC env var is missing');

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(' '));

    const client = new TonClient({
        endpoint: process.env.TON_RPC_URL || 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY ?? '',
    });

    // Open the facilitator wallet
    const wallet = client.open(
        WalletContractV4.create({ publicKey: keyPair.publicKey, workchain: 0 })
    );

    const seqno = await wallet.getSeqno();

    // Build the DateEscrow contract with init params
    const escrow = await DateEscrow.fromInit(
        Address.parse(params.wallet1),
        Address.parse(params.wallet2),
        toNano(params.amountTon.toString()),
    );

    const contractAddress = escrow.address.toString({ testOnly: true, bounceable: true });

    // Send deploy message (Deploy opcode) with 0.05 TON for gas
    await wallet.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
            internal({
                to: escrow.address,
                value: toNano('0.05'),
                init: escrow.init,
                bounce: false,
                // Deploy message body: opcode 2490013878 + queryId 0
                body: undefined, // The init itself deploys the contract
            }),
        ],
        sendMode: SendMode.PAY_GAS_SEPARATELY,
    });

    return contractAddress;
}
