import { cookies } from 'next/headers';

export async function getCurrentUserName(): Promise<string | null> {
    const cookieStore = await cookies();
    return cookieStore.get('chat_user')?.value || null;
}

export function normalizeName(name: unknown): string {
    return String(name || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 30);
}