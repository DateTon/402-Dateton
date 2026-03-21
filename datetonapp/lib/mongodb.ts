import { Db, MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
    throw new Error('MONGODB_URI est manquant dans les variables d’environnement');
}

declare global {
    // eslint-disable-next-line no-var
    var _mongoClientPromise: Promise<MongoClient> | undefined;
}

let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
    if (!global._mongoClientPromise) {
        const client = new MongoClient(uri);
        global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
} else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
}

export async function getDatabase(): Promise<Db> {
    const connectedClient = await clientPromise;
    return connectedClient.db(process.env.MONGODB_DB_NAME || 'chat_app');
}