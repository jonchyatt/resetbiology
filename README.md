# Reset Biology

Modern wellness platform built with Next.js, featuring comprehensive wellness tracking, breath training, and metabolic optimization tools.

## Stack

- **Auth**: Auth0 (Passwordless Email/Magic Link)
- **Database**: MongoDB Atlas via Prisma
- **Payments**: Stripe integration with webhooks
- **Frontend**: Next.js 15 with App Router, React 18, TypeScript
- **Styling**: Tailwind CSS with custom design system

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy `.env.example` to `.env.local` and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** and test login at `/api/auth/login`

## Key Features

- **Session-aware navigation** with Auth0 integration
- **Protected portal area** with server-side guards  
- **Stripe payment processing** with webhook handling
- **Breath training application** with session tracking
- **Marketing site** with hero sections and conversion optimization
- **Admin dashboard** for content management

## Environment Setup

Required environment variables (see `.env.example`):

- `AUTH0_*` - Auth0 configuration for authentication
- `DATABASE_URL` - MongoDB Atlas connection string
- `STRIPE_*` - Stripe keys for payment processing

See `docs/env-local.md` for detailed setup instructions.

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npx prisma studio` - Open database viewer
- `npx playwright test` - Run end-to-end tests

For more details, see `CLAUDE.md`.
