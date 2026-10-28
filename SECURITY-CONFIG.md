# Private configuration

Committed credentials were removed from the current source on 2026-10-28. The old values may remain in Git history or other copies; removing them from the latest files does not revoke them.

Set the following values in the runtime environment before starting the application:

- `MONGODB_URI`
- `MESSAGE_ENCRYPTION_KEY`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_URL`
- `RPC_API_KEY`
- `WALLET_MNEMONIC`
- `TELEGRAM_BOT_TOKEN`

Next.js reads local configuration in `datetonapp`. The tracked `.env.local` now leaves sensitive fields empty. Use your deployment secret settings or a private local environment; do not commit values. The wallet mnemonic must be treated as compromised and must not be reused for new funds or activity. Replacing the message-encryption key can affect access to previously encrypted messages: plan that migration separately.

Rotate or revoke exposed service credentials with their providers. Keep encryption-key migration and session invalidation in mind. The application, database access, mail delivery or bot login may remain unavailable until configuration is supplied. No live credentials were tested, and no services were accessed as part of this change.
