import { getDatabase } from '../lib/mongodb'

const activities = [
    {
        name: 'Soirée Cocktails',
        type: 'cocktail',
        description: 'Un verre dans un bar sympa pour apprendre à se connaître',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
        location: { name: 'Bar à cocktails', city: 'Lausanne', address: 'Place Saint-François' },
        priceRange: { min: 2, max: 8 },
        timeRange: { from: 18, to: 23 },
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Ciné en soirée',
        type: 'movie',
        description: 'Une séance de cinéma pour un premier rendez-vous sans pression',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
        location: { name: 'Cinéma Pathé', city: 'Lausanne', address: 'Flon' },
        priceRange: { min: 3, max: 10 },
        timeRange: { from: 17, to: 23 },
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Déjeuner sympa',
        type: 'food',
        description: 'Un bon repas pour faire connaissance',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        location: { name: 'Restaurant du Centre', city: 'Lausanne', address: 'Rue de Bourg' },
        priceRange: { min: 5, max: 15 },
        timeRange: { from: 11, to: 14 },
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Bowling',
        type: 'bowling',
        description: 'Une partie de bowling pour une ambiance décontractée',
        imageUrl: 'https://images.unsplash.com/photo-1545809074-59472b3f5ecc?w=800',
        location: { name: 'Bowling de Malley', city: 'Lausanne', address: 'Prilly' },
        priceRange: { min: 4, max: 12 },
        timeRange: { from: 14, to: 23 },
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Café du matin',
        type: 'cafe',
        description: 'Un café pour se retrouver sans pression',
        imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
        location: { name: 'Café Romand', city: 'Lausanne', address: 'Place Saint-François' },
        priceRange: { min: 1, max: 4 },
        timeRange: { from: 8, to: 12 },
        available: true,
        createdAt: new Date(),
    },
]

async function seed() {
    const db = await getDatabase()
    await db.collection('activities').deleteMany({})
    const result = await db.collection('activities').insertMany(activities)
    console.log(`✅ ${result.insertedCount} activities insérées !`)
    process.exit(0)
}

seed().catch((err) => {
    console.error('❌ Erreur seed :', err)
    process.exit(1)
})
