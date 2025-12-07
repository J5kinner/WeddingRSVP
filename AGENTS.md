# Repository Guidelines

Quick guide for the RSVP + admin-view site (Next.js 16, TypeScript, Neon Postgres). Keep changes small, secure, and lint-clean.

## Project Structure & Module Organization
- `src/app` uses the App Router; UI lives in `components/` (`SecureRSVPForm`, `RSVPList`); API route at `api/rsvp/route.ts`.
- Admin responses view should live under `src/app/admin` (server-first); reuse `RSVPList` data or fetch via `/api/rsvp`.
- `src/lib` holds shared utilities: security/validation (`security.ts`, `csrf.ts`), rate limiting, Prisma client bootstrap, and class name helper.
- `prisma/schema.prisma` defines the `RSVP` model mapped to `rsvps`; add migrations here.
- `public/` holds assets; configs live in `eslint.config.mjs`, `next.config.ts`, and Tailwind globals at `src/app/globals.css`. Env lives in `.env` (`DATABASE_URL`, optional `ALLOWED_ORIGINS`).

## Build, Test, and Development Commands
- `pnpm install` (preferred) or `npm install` to fetch deps.
- `pnpm dev` to run the app at `localhost:3000`.
- `pnpm build` for a production build; `pnpm start` serves the built output.
- `pnpm lint` runs Next/ESLint rules; use `pnpm lint --fix` for autofixable issues.
- `npx prisma generate` regenerates the Prisma client after schema changes; ensure `DATABASE_URL` is set.

## Coding Style & Naming Conventions
- TypeScript-first; functional React; client components declare `'use client'`. Two-space indent, single quotes, no trailing semicolons.
- Components use `PascalCase`; helpers use `camelCase`. Keep App Router segments lowercase. Tailwind utilities drive styling; prefer `cn` when merging class names.
- Centralize security—reuse `validateRSVPData`, `getSecurityHeaders`, rate limit helpers, and CSRF utilities.

## Admin Page Guidelines
- Protect access (basic auth, token gate, middleware) so only admins view RSVPs.
- Prefer server components/actions; never expose DB credentials to the client.
- Pull data via `/api/rsvp` or Prisma server-side; include filters for attending/not and quick counts.
- If adding admin mutations, reuse CSRF, validation, and rate-limit helpers.

## Testing Guidelines
- Run `pnpm lint` before pushing. If adding tests, keep them in `src/__tests__/` or alongside components using React Testing Library; mock Neon/Prisma for validation/rate-limit/CSRF coverage.

## Commit & Pull Request Guidelines
- Use imperative, concise commit messages (e.g., `Add secure RSVP validation`); group related changes.
- PRs: short summary, testing notes, screenshots/GIFs for UI changes, and call out DB/env changes. Never commit secrets; include migration steps when schema changes.

## Security & Configuration Notes
- Respect existing protections: keep CSRF tokens, origin checks, and rate limits intact; adjust `RATE_LIMIT_CONFIGS` thoughtfully with rationale.
- Validate and sanitize all user-facing data with helpers in `src/lib/security.ts` and escape display content (`sanitizeHTML`) before rendering.
