<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

<h1 align="center">Games-Games-Games (GGG)</h1>

<p align="center">
  <strong>The Ultimate High-Performance Gaming Monolith</strong>
</p>

<p align="center">
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-18%2B-green.svg" alt="Node.js"></a>
  <a href="https://nestjs.com"><img src="https://img.shields.io/badge/Framework-NestJS-red.svg" alt="NestJS"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/Language-TypeScript-blue.svg" alt="TypeScript"></a>
  <a href="https://www.mongodb.com/"><img src="https://img.shields.io/badge/Database-MongoDB-green.svg" alt="MongoDB"></a>
  <a href="https://redis.io/"><img src="https://img.shields.io/badge/Cache%20%26%20Queues-Redis-red.svg" alt="Redis"></a>
  <a href="https://socket.io/"><img src="https://img.shields.io/badge/Realtime-Socket.IO-black.svg" alt="Socket.IO"></a>
</p>

---

## 🚀 Overview

**GGG/ggg** is a state-of-the-art backend monolith designed to power a next-generation real-time gaming platform. Built with scalability, performance, and developer experience in mind, it leverages the full power of **NestJS** running on **Fastify** to deliver blazing fast response times.

This isn't just an API; it's a comprehensive ecosystem handling everything from real-time multiplayer game synchronization to secure financial transactions.

## ✨ Key Features

This platform is packed with robust modules designed for high availability and rich user interaction:

- **🎮 Core Game Engine**: A robust, event-driven game engine capable of handling complex turn-based logic (Dice, etc.) with millisecond-precision synchronization.
- **⚔️ Advanced Matchmaking**: Real-time matchmaking system that pairs players instantly using efficient queueing algorithms.
- **💰 Secure Wallet & Payments**: Integrated financial system supporting **Stripe, Paystack, and Flutterwave**. Handles deposits, withdrawals, and secure escrow for high-stakes matches.
- **🔔 Omnichannel Notifications**: A provider-agnostic notification system delivering alerts via **In-App, Push, Email (SendGrid/Mailgun/Mailchimp), SMS (Twilio/Vonage), and WhatsApp**.
- **🤝 Social Graph**: Complete friends system with friend requests, follows, and activity feeds.
- **🛡️ Iron-Clad Auth**: Secure authentication flow using **JWT, Passport, and Google OAuth**, protected by global guards and throttling. Includes comprehensive **MFA (Multi-Factor Authentication)** support:
  - **Passkeys (WebAuthn)**: Modern, phishing-resistant, passwordless login.
  - **Authenticator Apps (TOTP)**: Compatible with Google Authenticator, Authy, etc.
  - **Email & SMS**: OTP verification codes sent via preferred channels.
  - **Backup Codes**: Recovery mechanism for lost access.
- **👀 Control Center**: Dedicated admin module for platform oversight, user management, and system health monitoring.

## 🛠️ Engineering Excellence & Trade-offs

We didn't just build it to work; we built it to **scale**. Here are some of the engineering decisions that set GGG apart:

### ⚡ Performance First (Fastify vs Express)

We chose **Fastify** as the underlying HTTP adapter instead of Express.

- **Why?** Fastify can handle up to **2x more requests per second** than Express, capable of serving 30k+ requests/sec.
- **The Trade-off:** Maximum raw performance over the vast plugin ecosystem of Express (though Fastify's ecosystem is now mature).

### 🔄 Horizontal Scalability (Redis Adapters)

Real-time features use **Socket.IO with Redis Adapters**.

- **Benefit:** This allows the app to scale horizontally across multiple instances/containers. Game state and messages are propagated across the cluster instantly.
- **Architecture:** Sticky sessions + Redis Pub/Sub ensure a seamless connection experience even under heavy load.

### 📨 Async Processing (BullMQ)

Heavy operations never block the main thread. We use **BullMQ** (Redis-based) for:

- Sending Emails/SMS
- Processing Wallet Transactions
- Handling complex game state calculations
- **Benefit:** The API remains snappy for the user while heavy lifting happens in the background.

### 🔭 Deep Observability

- **OpenTelemetry & HyperDX**: Native integration for distributed tracing. We can see exactly where every millisecond goes.
- **Pino Logger**: High-performance, low-overhead JSON logging for production environments.

### 🛡️ Type Safety & Validation

- **Zod Integration**: We use `nestjs-zod` for runtime validation that infers static TypeScript types. One source of truth for both code and validation logic.

## 📂 Project Structure

A clean, modular monolith structure ensures code maintainability:

```text
src/
├── app.module.ts           # Root module aggregating all features
├── main.ts                 # Application entry point (Fastify bootstrap)
├── guards/                 # Global security guards (Auth, Roles)
└── modules/                # Feature-based modules
    ├── auth/               # Authentication & Authorization
    ├── control-center/     # Admin Dashboard Logic
    ├── friends/            # Social Graph
    ├── game/               # Core Game Logic & State Machine
    ├── health/             # Health Checks & Terminus
    ├── matchmaking/        # Queueing System
    ├── notifications/      # Multi-channel Notification System
    ├── payments/           # Payment Gateway Integrations
    ├── uploads/            # File Uploads (Cloudinary/S3)
    ├── users/              # User Management
    └── wallet/             # Ledger & Transaction Management
libs/
└── common/                 # Shared utilities, database connections, and filters
```

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- Redis (Required for Queues & Socket.IO)
- MongoDB
- PostgreSQL (Optional, depending on config)

### Installation

```bash
$ npm install
```

### Running the app

```bash
# development
$ npm run start

# watch mode (Standard)
$ npm run start:dev

# production mode
$ npm run start:prod
```

### Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## 📄 License

This project is [UNLICENSED](LICENSE).
