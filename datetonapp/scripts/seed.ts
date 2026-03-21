/**
 * Seed script — inserts fake dev users into the database.
 *
 * Run with:  npx tsx scripts/seed.ts
 *   --reset  flag deletes all seed users first (telegramId < 0) then re-inserts.
 *
 * Idempotent by default: skips users whose telegramId already exists.
 * Uses negative telegramIds so they never collide with real Telegram users.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local before anything else (must happen before dynamic import of db)
const envPath = resolve(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx);
    const val = trimmed.slice(idx + 1);
    if (!process.env[key]) process.env[key] = val;
}

const ALL_GENDERS = [
    'Man', 'Woman', 'Non-binary', 'Trans man', 'Trans woman',
    'Genderfluid', 'Agender', 'Genderqueer', 'Bigender',
    'Demiboy', 'Demigirl', 'Prefer not to say',
];

const SEED_USERS = [
    // ── "Me" test user (the current user used for matching) ──
    {
        telegramId: -1,
        firstName: 'Dev',
        lastName: 'Tester',
        age: 24,
        gender: 'Man',
        interestedIn: ['Woman', 'Non-binary', 'Trans woman'],
        interests: ['Coffee', 'Gym', 'Movies', 'Museums'],
        bio: 'Dev test account for matching.',
        images: [],
        walletAddress: '',
    },
    // ── Seed profiles ──
    {
        telegramId: -100,
        firstName: 'Alice',
        lastName: 'Rey',
        age: 21,
        gender: 'Woman',
        interestedIn: [...ALL_GENDERS],
        interests: ['Coffee', 'Yoga', 'Gym'],
        bio: 'I want a serious and pure relationship.',
        images: [
            'https://i.pinimg.com/1200x/47/96/ba/4796babd867068256977d2e263f4b6fc.jpg',
            'https://i.pinimg.com/736x/3f/a5/68/3fa568f1f83ead960fee8c783f69b4a7.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -101,
        firstName: 'Margot',
        lastName: 'Rossie',
        age: 23,
        gender: 'Woman',
        interestedIn: [...ALL_GENDERS],
        interests: ['Cats', 'Picnics', 'Sunset views'],
        bio: "I love romantic dates full of care and attention.",
        images: [
            'https://i.pinimg.com/736x/13/3c/fa/133cfa765bafc199166cce2a02dd6801.jpg',
            'https://i.pinimg.com/736x/72/84/7d/72847d92305072547709795e74c9fd21.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -102,
        firstName: 'Armand',
        lastName: 'Selly',
        age: 24,
        gender: 'Man',
        interestedIn: [...ALL_GENDERS],
        interests: ['Movies', 'Gym', 'Netflix'],
        bio: 'Interested in serious dates with people who have a fun vibe and good energy.',
        images: [
            'https://i.pinimg.com/736x/fb/e9/91/fbe991adf1f4b88fe13df9b5ba832740.jpg',
            'https://i.pinimg.com/736x/41/b4/07/41b4075b9c77c6db4b4ee5af9285e77d.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -103,
        firstName: 'Arthur',
        lastName: 'Pont',
        age: 26,
        gender: 'Man',
        interestedIn: [...ALL_GENDERS],
        interests: ['Museums', 'Language learning', 'Board games'],
        bio: 'I like deep conversations where you truly get to know people.',
        images: [
            'https://i.pinimg.com/1200x/20/06/32/20063217187aae58f8326e44b0c218e6.jpg',
            'https://i.pinimg.com/736x/d3/91/73/d39173de174fe958c4c12917b048f002.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -104,
        firstName: 'Lina',
        lastName: 'Moore',
        age: 22,
        gender: 'Trans woman',
        interestedIn: [...ALL_GENDERS],
        interests: ['Coffee', 'Brunch', 'Museums'],
        bio: "I'm looking for a soft and genuine connection, with deep conversations and cute dates.",
        images: [
            'https://i.pinimg.com/736x/d1/c2/6f/d1c26f01eda84435cfaf169fc29639a8.jpg',
            'https://i.pinimg.com/1200x/8c/3e/5c/8c3e5cc7806828e86cb3b5deab12f122.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -105,
        firstName: 'Sofia',
        lastName: 'Lane',
        age: 24,
        gender: 'Woman',
        interestedIn: [...ALL_GENDERS],
        interests: ['Sunset views', 'Picnics', 'Live music'],
        bio: 'I love romantic moments, small details, and people who know how to make a date feel special.',
        images: [
            'https://i.pinimg.com/736x/2f/87/b9/2f87b9a14c2dc4eb66188e644601908d.jpg',
            'https://i.pinimg.com/1200x/4b/f9/c1/4bf9c1777e630a6c8b57eefdd025f517.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -106,
        firstName: 'Ethan',
        lastName: 'Cole',
        age: 25,
        gender: 'Non-binary',
        interestedIn: [...ALL_GENDERS],
        interests: ['Gym', 'Movies', 'Night walks'],
        bio: 'Looking for something serious with someone fun, calm, and easy to vibe with.',
        images: [
            'https://i.pinimg.com/736x/72/85/c2/7285c2a502428d07dcd2955003a3f35c.jpg',
            'https://i.pinimg.com/736x/57/01/1f/57011f0717fd9fe73ced1fcc20b5ffd1.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -107,
        firstName: 'Noah',
        lastName: 'Bennett',
        age: 28,
        gender: 'Man',
        interestedIn: [...ALL_GENDERS],
        interests: ['Books', 'Coffee', 'Board games'],
        bio: 'I like simple dates, real chemistry, and conversations that make time disappear.',
        images: [
            'https://i.pinimg.com/736x/7b/70/eb/7b70eb5a01f19ef03fdeafa7d3a76f22.jpg',
            'https://i.pinimg.com/1200x/a7/c4/ec/a7c4ecd81f43c58e487e665e37d81099.jpg',
        ],
        walletAddress: '',
    },
    {
        telegramId: -108,
        firstName: 'Chloe',
        lastName: 'Hart',
        age: 21,
        gender: 'Woman',
        interestedIn: [...ALL_GENDERS],
        interests: ['Yoga', 'Fashion', 'Travel'],
        bio: 'I want a healthy and serious relationship with someone kind, ambitious, and emotionally mature.',
        images: [
            'https://i.pinimg.com/1200x/19/28/a6/1928a602f1adf29c9f5e8c700a2d445d.jpg',
            'https://i.pinimg.com/736x/40/9f/4e/409f4ee978ed4eeab329c0fff43b6ef4.jpg',
        ],
        walletAddress: '',
    },
];

async function seed() {
    const { findUserByTelegramId, createUser } = await import('../lib/db');
    const { getDatabase } = await import('../lib/mongodb');

    const reset = process.argv.includes('--reset');

    if (reset) {
        console.log('🗑  Resetting seed users (telegramId < 0)...');
        const db = await getDatabase();
        const result = await db.collection('users').deleteMany({ telegramId: { $lt: 0 } });
        console.log(`   Deleted ${result.deletedCount} seed users.\n`);
    }

    console.log('🌱 Seeding dev users...\n');

    for (const userData of SEED_USERS) {
        const existing = await findUserByTelegramId(userData.telegramId);
        if (existing) {
            console.log(`  ⏭  ${userData.firstName} ${userData.lastName} (id ${userData.telegramId}) already exists — skipped`);
            continue;
        }
        await createUser(userData);
        console.log(`  ✅ ${userData.firstName} ${userData.lastName} (id ${userData.telegramId}) created`);
    }

    console.log('\n🌱 Seed complete.');
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
