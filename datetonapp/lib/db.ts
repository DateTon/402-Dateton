import { getDatabase } from './mongodb';
import { encryptText, decryptText, type EncryptedPayload } from './crypto';

export type User = {
    telegramId: number;
    firstName: string;
    lastName: string;
    age: number;
    bio: string;
    gender: string;
    interestedIn: string[];
    interests: string[];
    images: string[];
    walletAddress: string;
    createdAt: Date;
    updatedAt: Date;
};

type EncryptedUser = {
    telegramId: number;
    firstName: EncryptedPayload;
    lastName: EncryptedPayload;
    age: number;
    bio: EncryptedPayload;
    gender: EncryptedPayload;
    interestedIn: EncryptedPayload;
    interests: string[];
    images: EncryptedPayload;
    walletAddress: EncryptedPayload;
    createdAt: Date;
    updatedAt: Date;
};

const COLLECTION = 'users';

function isEncryptedPayload(val: unknown): val is EncryptedPayload {
    return typeof val === 'object' && val !== null && 'cipherText' in val && 'iv' in val && 'authTag' in val;
}

function safeDecrypt(val: unknown, fallback = ''): string {
    if (isEncryptedPayload(val)) return decryptText(val);
    if (typeof val === 'string') return val;
    return fallback;
}

function encryptUser(data: User): EncryptedUser {
    return {
        telegramId: data.telegramId,
        firstName: encryptText(data.firstName),
        lastName: encryptText(data.lastName),
        age: data.age,
        bio: encryptText(data.bio),
        gender: encryptText(data.gender),
        interestedIn: encryptText(JSON.stringify(data.interestedIn)),
        interests: data.interests,
        images: encryptText(JSON.stringify(data.images)),
        walletAddress: encryptText(data.walletAddress),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
    };
}

function decryptUser(doc: Record<string, unknown>): User {
    let interestedIn: string[] = [];
    const rawInterested = doc.interestedIn;
    if (isEncryptedPayload(rawInterested)) {
        try { interestedIn = JSON.parse(decryptText(rawInterested)); } catch { interestedIn = []; }
    } else if (Array.isArray(rawInterested)) {
        interestedIn = rawInterested as string[];
    }

    return {
        telegramId: doc.telegramId as number,
        firstName: safeDecrypt(doc.firstName),
        lastName: safeDecrypt(doc.lastName),
        age: (doc.age as number) ?? 18,
        bio: safeDecrypt(doc.bio),
        gender: safeDecrypt(doc.gender),
        interestedIn,
        interests: (doc.interests as string[]) ?? [],
        images: (() => {
            const raw = doc.images;
            if (isEncryptedPayload(raw)) {
                try { return JSON.parse(decryptText(raw)); } catch { return []; }
            }
            if (Array.isArray(raw)) return raw as string[];
            return [];
        })(),
        walletAddress: safeDecrypt(doc.walletAddress),
        createdAt: doc.createdAt as Date,
        updatedAt: doc.updatedAt as Date,
    };
}

export async function findUserByTelegramId(telegramId: number): Promise<User | null> {
    const db = await getDatabase();
    const doc = await db.collection(COLLECTION).findOne({ telegramId });
    if (!doc) return null;
    return decryptUser(doc as Record<string, unknown>);
}

export async function createUser(data: Partial<User> & { telegramId: number }): Promise<User> {
    const db = await getDatabase();
    const now = new Date();
    const user: User = {
        telegramId: data.telegramId,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        age: data.age ?? 18,
        bio: data.bio ?? '',
        gender: data.gender ?? '',
        interestedIn: data.interestedIn ?? [],
        interests: data.interests ?? [],
        images: data.images ?? [],
        walletAddress: data.walletAddress ?? '',
        createdAt: now,
        updatedAt: now,
    };
    const encrypted = encryptUser(user);
    await db.collection(COLLECTION).insertOne(encrypted);
    return user;
}

export async function updateUser(telegramId: number, data: Partial<User>): Promise<User | null> {
    const db = await getDatabase();
    const existing = await findUserByTelegramId(telegramId);
    if (!existing) return null;

    const merged: User = { ...existing, ...data, updatedAt: new Date() };
    const encrypted = encryptUser(merged);

    await db.collection(COLLECTION).updateOne(
        { telegramId },
        { $set: encrypted }
    );
    return merged;
}
