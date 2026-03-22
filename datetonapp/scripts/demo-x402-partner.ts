/**
 * Demo script — simulates a partner system paying via x402
 * when a couple selects their bundle.
 *
 * Usage:
 *   PARTNER_DEMO_PRIVATE_KEY=<hex-seed> npx tsx scripts/demo-x402-partner.ts
 *
 * Requires a TON testnet keypair. The private key (seed) must be
 * set in .env.local as PARTNER_DEMO_PRIVATE_KEY.
 */

import 'dotenv/config'
import { x402Fetch, type X402ClientConfig } from '../../packages/client/src/index'
import { mnemonicToPrivateKey } from '@ton/crypto'
import { WalletContractV4 } from '@ton/ton'
import { TonClient } from '@ton/ton'

const BUNDLE_ID = process.argv[2] || 'REPLACE_WITH_BUNDLE_ID'
const MATCH_ID = process.argv[3] || 'demo-match-123'

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000'
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? `${BASE_URL}/api/facilitator`

async function main() {
    const mnemonic = process.env.PARTNER_DEMO_PRIVATE_KEY
    if (!mnemonic) {
        console.error('Set PARTNER_DEMO_PRIVATE_KEY in .env.local (24-word mnemonic)')
        process.exit(1)
    }

    const keypair = await mnemonicToPrivateKey(mnemonic.split(' '))
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey })

    const client = new TonClient({
        endpoint: process.env.TON_RPC_URL ?? 'https://testnet.toncenter.com/api/v2/jsonRPC',
        apiKey: process.env.RPC_API_KEY,
    })

    const openedWallet = client.open(wallet)

    const config: X402ClientConfig = {
        wallet: openedWallet,
        keypair,
        verbose: true,
        client,
    }

    console.log(`\nSelecting bundle ${BUNDLE_ID} for match ${MATCH_ID}...\n`)

    const { response, paid } = await x402Fetch(
        `${BASE_URL}/api/bundles/${BUNDLE_ID}/select`,
        config,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matchId: MATCH_ID }),
        },
    )

    if (response.ok) {
        console.log(`\nBundle selected${paid ? ', 0.1 TON debited automatically' : ''}`)
        console.log(await response.json())
    } else {
        console.error(`\nFailed: ${response.status} ${response.statusText}`)
        console.error(await response.text())
    }
}

main().catch(console.error)
