# Wedding RSVP

## Features
- **Guest Management**: RSVP form with duplicate prevention & dietary tracking
- **Admin Dashboard**: Real-time summary statistics & guest list
- **Interactive UI**: 3D animated ring & canvas scrubbing effects
- **Responsive Design**: Mobile-first layout for all devices

## Tech Stack
Next.js 16, TypeScript, Tailwind CSS, Prisma, Neon (PostgreSQL), Three.js (R3F)

## Quick Start

1. **Install dependencies** (automatically generates Prisma client):
   ```bash
   pnpm install
   ```

2. **Environment Setup**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@host/database?sslmode=require"
   ```

3. **Run Development Server**:
   ```bash
   pnpm dev
   ```

## Pipeline Checks
Run these before committing to ensure CI passes:
```bash
# Linting
pnpm lint

# Type checking & Build verification
pnpm build
```

## Database
- Schema location: `prisma/schema.prisma`
- Push schema changes: `pnpm dlx prisma db push`
- View data: `pnpm dlx prisma studio`

## Deployment
Standard Next.js deployment (e.g., Vercel).
- Build command: `pnpm build`
- Install command: `pnpm install`
