import { getDatabase } from '../lib/mongodb'

// schedule: array of 7 days (Mon=0 .. Sun=6), each is [open, close] or null if closed
// Times as strings like "12h30", "23h00"
const activities = [
    {
        name: 'Soiree Cocktails',
        type: 'cocktail',
        description: 'Un verre dans un bar sympa pour apprendre a se connaitre',
        imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
        location: { name: 'Bar a cocktails', city: 'Lausanne', address: 'Place Saint-Francois' },
        averagePrice: 0.3,
        schedule: [
            ['18h00', '23h00'], // Mon
            ['18h00', '23h00'], // Tue
            ['18h00', '23h00'], // Wed
            ['18h00', '23h30'], // Thu
            ['17h00', '00h00'], // Fri
            ['17h00', '00h00'], // Sat
            null,               // Sun - closed
        ],
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Cine en soiree',
        type: 'movie',
        description: 'Une seance de cinema pour un premier rendez-vous sans pression',
        imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
        location: { name: 'Cinema Pathe', city: 'Lausanne', address: 'Flon' },
        averagePrice: 0.4,
        schedule: [
            ['14h00', '23h00'], // Mon
            ['14h00', '23h00'], // Tue
            ['14h00', '23h00'], // Wed
            ['14h00', '23h00'], // Thu
            ['14h00', '23h30'], // Fri
            ['11h00', '23h30'], // Sat
            ['11h00', '22h00'], // Sun
        ],
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Dejeuner sympa',
        type: 'food',
        description: 'Un bon repas pour faire connaissance',
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        location: { name: 'Restaurant du Centre', city: 'Lausanne', address: 'Rue de Bourg' },
        averagePrice: 0.5,
        schedule: [
            ['11h30', '14h00'], // Mon
            ['11h30', '14h00'], // Tue
            ['11h30', '14h00'], // Wed
            ['11h30', '14h00'], // Thu
            ['11h30', '14h30'], // Fri
            ['11h00', '15h00'], // Sat
            null,               // Sun - closed
        ],
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Bowling',
        type: 'bowling',
        description: 'Une partie de bowling pour une ambiance decontractee',
        imageUrl: 'https://i.pinimg.com/736x/fa/2d/21/fa2d21f56d7c44e03760a3db74a306e6.jpg',
        location: { name: 'Bowling de Malley', city: 'Lausanne', address: 'Prilly' },
        averagePrice: 0.3,
        schedule: [
            ['14h00', '22h00'], // Mon
            ['14h00', '22h00'], // Tue
            ['14h00', '22h00'], // Wed
            ['14h00', '23h00'], // Thu
            ['14h00', '23h30'], // Fri
            ['10h00', '23h30'], // Sat
            ['10h00', '22h00'], // Sun
        ],
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Late Night Lounge',
        type: 'lounge',
        description: 'Un lounge ouvert tard pour une soiree intime',
        imageUrl: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800',
        location: { name: 'Le Nocturne', city: 'Lausanne', address: 'Rue du Grand-Pont' },
        averagePrice: 0.2,
        schedule: [
            null,               // Mon - closed
            null,               // Tue - closed
            null,               // Wed - closed
            ['22h00', '02h00'], // Thu
            ['22h00', '03h00'], // Fri
            ['23h00', '03h00'], // Sat
            ['00h00', '02h00'], // Sun (late night from Sat)
        ],
        available: true,
        createdAt: new Date(),
    },
    {
        name: 'Cafe du matin',
        type: 'cafe',
        description: 'Un cafe pour se retrouver sans pression',
        imageUrl: 'https://i.pinimg.com/736x/c7/50/04/c75004d84973179652aa7ca0e25af18d.jpg',
        location: { name: 'Cafe Romand', city: 'Lausanne', address: 'Place Saint-Francois' },
        averagePrice: 0.1,
        schedule: [
            ['07h30', '12h00'], // Mon
            ['07h30', '12h00'], // Tue
            ['07h30', '12h00'], // Wed
            ['07h30', '12h00'], // Thu
            ['07h30', '12h00'], // Fri
            ['08h00', '13h00'], // Sat
            ['08h00', '13h00'], // Sun
        ],
        available: true,
        createdAt: new Date(),
    },
]

async function seed() {
    const db = await getDatabase()
    await db.collection('activities').deleteMany({})
    const result = await db.collection('activities').insertMany(activities)
    console.log(`${result.insertedCount} activities inserees !`)
    process.exit(0)
}

seed().catch((err) => {
    console.error('Erreur seed :', err)
    process.exit(1)
})
