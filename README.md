# DateTon

A Telegram-native dating app on TON that turns matches into real dates through escrow-backed commitment.

## Concept

Most dating apps fail because there is no real commitment: people match, chat, delay, cancel, or ghost.

DateTon solves this by creating a **date pact** between two matched users. Once both agree on a date, they each deposit an agreed amount into a **TON escrow smart contract**. The funds stay locked until the planned meetup. To validate the date and release the funds, both users must confirm using crossed verification codes.

This creates real commitment and pushes matches to become actual dates.

## Why TON + Telegram

- **Telegram Mini App** for fast onboarding and native distribution
- **TonConnect** for wallet connection
- **TON smart contracts** for escrow-backed commitment
- **Telegram notifications** to keep users engaged

## Main Features

- Telegram login
- Profile creation and photo upload
- Wallet connection
- Swipe / match system
- Encrypted chat between matches
- Encrypted user data
- In-chat negotiation of budget, activity, date and time
- Automatic deployment of escrow smart contract on agreement
- TON escrow deposit
- Cross-code validation to release funds
- Refund flow
- **Boost** feature via TonConnect
- **Protocol x402** integration for partner-driven monetization

## Privacy

All user data is encrypted.
All chat messages are encrypted.
Privacy and secure interactions are a core part of DateTon.

## Boost

Users can buy a **Boost** for **1 TON**.

The Boost:

- places the user at the top of the feed for 1 hour
- increases profile visibility
- removes bid fees during the boost period

## Smart Contract

`DateEscrow.tact` handles:

- `Fund`
- `ConfirmRelease`
- `Release`
- `Refund`

## Monetization

- Fixed funding date fee: **0.05 TON per user**
- Fixed refunding fee : 0.1 TON per request
- **Boost** purchase: **1 TON**
- **Protocol x402**: **0.1 TON** per date (paid by partners for each client brought to them)

## Demo

Current app link:
[https://datetonapp.vercel.app](https://datetonapp.vercel.app)

Demo : 
https://www.youtube.com/watch?v=6zt-bACV4tA

Accessible only through Telegram.

## Local Setup

Create a `.env.local` file by following the example provided in `.env.example`.

```bash
git clone <repo-link>
cd <project-folder>
npm install
npm run dev
```
