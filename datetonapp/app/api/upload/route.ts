import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'Unsupported format (JPG, PNG, WebP only)' }, { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'Image too large (max 5MB)' }, { status: 400 });
        }

        const cloudName = process.env.CLOUDINARY_URL?.split('@')[1] || '';
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Cloudinary configuration missing' }, { status: 500 });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const paramsToSign = `folder=dateton&timestamp=${timestamp}`;

        const encoder = new TextEncoder();
        const keyData = encoder.encode(paramsToSign + apiSecret);
        const hashBuffer = await crypto.subtle.digest('SHA-1', keyData);
        const signature = Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        const uploadData = new FormData();
        uploadData.append('file', file);
        uploadData.append('api_key', apiKey);
        uploadData.append('timestamp', String(timestamp));
        uploadData.append('signature', signature);
        uploadData.append('folder', 'dateton');

        const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: uploadData,
        });

        const result = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: result.error?.message || 'Upload failed' }, { status: 500 });
        }

        return NextResponse.json({ url: result.secure_url });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
