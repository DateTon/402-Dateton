import { ObjectId } from 'mongodb';
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '../../../lib/mongodb';
import {
    decryptText,
    encryptText,
    type EncryptedPayload,
} from '../../../lib/crypto';
import { getCurrentUserName } from '../../../lib/auth';

type CreateMessageRequestBody = {
    message?: unknown;
};

type MessageDocument = {
    _id?: ObjectId;
    userName: string;
    encryptedMessage: EncryptedPayload;
    createdAt: string;
};

export async function GET() {
    const currentUser = await getCurrentUserName();

    if (!currentUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const db = await getDatabase();

    const documents = await db
        .collection<MessageDocument>('messages')
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray();

    const messages = documents.reverse().map((doc) => ({
        id: String(doc._id),
        userName: doc.userName,
        createdAt: doc.createdAt,
        message: decryptText(doc.encryptedMessage),
    }));

    return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
    const currentUser = await getCurrentUserName();

    if (!currentUser) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    let body: CreateMessageRequestBody;

    try {
        body = (await request.json()) as CreateMessageRequestBody;
    } catch {
        return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
    }

    const rawMessage = String(body.message || '').trim();

    if (!rawMessage) {
        return NextResponse.json({ error: 'Le message est vide' }, { status: 400 });
    }

    if (rawMessage.length > 1000) {
        return NextResponse.json(
            { error: 'Le message est trop long' },
            { status: 400 }
        );
    }

    const encryptedMessage = encryptText(rawMessage);
    const db = await getDatabase();

    const result = await db.collection<MessageDocument>('messages').insertOne({
        userName: currentUser,
        encryptedMessage,
        createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
        ok: true,
        insertedId: String(result.insertedId),
    });
}