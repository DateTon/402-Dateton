import crypto, { type CipherGCM, type DecipherGCM } from 'crypto';

const algorithm = 'aes-256-gcm';

export type EncryptedPayload = {
    algorithm: string;
    iv: string;
    authTag: string;
    cipherText: string;
};

function getKey(): Buffer {
    const secret = process.env.MESSAGE_ENCRYPTION_KEY;

    if (!secret) {
        throw new Error(
            'MESSAGE_ENCRYPTION_KEY est manquant dans les variables d’environnement'
        );
    }

    return crypto.createHash('sha256').update(secret).digest();
}

export function encryptText(plainText: string): EncryptedPayload {
    const iv = crypto.randomBytes(12);
    const key = getKey();
    const cipher = crypto.createCipheriv(algorithm, key, iv) as CipherGCM;

    const encrypted = Buffer.concat([
        cipher.update(plainText, 'utf8'),
        cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
        algorithm,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        cipherText: encrypted.toString('base64'),
    };
}

export function decryptText(payload: EncryptedPayload): string {
    const key = getKey();

    const decipher = crypto.createDecipheriv(
        payload.algorithm,
        key,
        Buffer.from(payload.iv, 'base64')
    ) as DecipherGCM;

    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(payload.cipherText, 'base64')),
        decipher.final(),
    ]);

    return decrypted.toString('utf8');
}