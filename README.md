# Wedding RSVP Website

A wedding RSVP management system built with Next.js, TypeScript, and Neon PostgreSQL.
As well as some friends Emily Savage (Design) and Bailey Gibbons (Game Dev)

## Features

- Guest RSVP submission form
- Real-time RSVP list with summary statistics
- Duplicate prevention (updates existing RSVPs by invite code)
- Dietary restrictions and special requests tracking
- Responsive design for mobile and desktop
- Canvas image scrubbing similar to Apple airpods animation for proposal
- 3D animated ring of engagement ring



https://github.com/user-attachments/assets/6b783528-a3cb-4a7e-be59-2e0eced73309



## Tech Stack

- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Database:** Neon (PostgreSQL)
- **Styling:** Tailwind CSS
- **ORM:** Prisma

## Getting Started

1. Install dependencies:
```bash
pnpm install
```

2. Set up environment variables:
Create a `.env` file with your Neon database connection string:
```
DATABASE_URL="your-neon-connection-string"
```

3. Generate Prisma client:
```bash
npx prisma generate
```

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Setup

The database schema is defined in `prisma/schema.prisma`. The RSVP table is automatically created when you first run the application.

## Deployment

This project can be deployed on Vercel, Netlify, or any platform that supports Next.js applications.
