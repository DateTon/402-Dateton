import { readFileSync } from 'fs'
import { resolve } from 'path'

// Load .env.local before anything else
const envPath = resolve(__dirname, '..', '.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx)
    const val = trimmed.slice(idx + 1)
    if (!process.env[key]) process.env[key] = val
}

const bundles = [
    {
        name: 'VIP Nightclub Entry',
        description: 'Entrée VIP pour 2 dans la meilleure boîte de nuit de la ville, accès zone premium inclus',
        partnerName: 'Club Nyx',
        partnerWallet: '0QC-rVAj9OAcvMddRWfk5G6m7f_AQoEzMxWgoAUTquw4xU1h',
        price: 0.1,
        emoji: '🎉',
        imageUrl: 'https://i.pinimg.com/1200x/d0/2f/f2/d02ff2a070b08cbe489a46d072f281ae.jpg',
        location: { name: 'Club Nyx', city: 'Lausanne', address: 'Rue du Grand-Pont' },
        averagePrice: 0.1,
        schedule: [
            ['20h00', '23h30'], // Mon
            ['20h00', '23h30'], // Tue
            ['20h00', '23h30'], // Wed
            ['20h00', '23h30'], // Thu
            ['20h00', '23h30'], // Fri
            ['20h00', '23h30'], // Sat
            ['20h00', '23h30'], // Sun
        ],
        available: true,
        type: 'bundle' as const,
        createdAt: new Date(),
    },
]

async function seed() {
    const { getDatabase } = await import('../lib/mongodb')
    const db = await getDatabase()
    await db.collection('bundles').deleteMany({})
    const result = await db.collection('bundles').insertMany(bundles)
    console.log(`${result.insertedCount} bundles insérés !`)
    process.exit(0)
}

seed().catch((err) => {
    console.error('Erreur seed bundles :', err)
    process.exit(1)
})