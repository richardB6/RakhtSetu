# RakthSetu Deployment Guide

## Requirements

- Node.js 20.19+ or 22.12+
- npm
- MongoDB Atlas cluster or compatible MongoDB deployment
- Vercel account for hosting

## Local setup

```bash
npm install
npm run dev
```

## Environment variables

Create a production environment file using the project template:

```bash
cp .env.example .env.local
```

Then fill in real deployment values for each variable, without committing secrets to source control.

Required variables:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NODE_ENV`
- `DEMO_MODE`
- `SEED_ON_STARTUP`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_MAP_TILE_URL`
- `NEXT_PUBLIC_MAP_ATTRIBUTION`
- `SEED_SECRET`

## MongoDB Atlas setup

1. Create a MongoDB Atlas cluster.
2. Create a database user with a strong password.
3. Add the deployment IP or use Vercel's outbound IPs / Private Networking if required.
4. Copy the connection string into `MONGODB_URI`.
5. Ensure the deployment environment can reach the Atlas cluster.

## Vercel configuration

Configure the following environment variables in Vercel:

- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `NODE_ENV=production`
- `DEMO_MODE=false`
- `SEED_ON_STARTUP=false`
- `NEXT_PUBLIC_APP_URL=https://your-production-domain.com`
- `NEXT_PUBLIC_APP_NAME=RakthSetu`
- `NEXT_PUBLIC_MAP_TILE_URL=https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`
- `NEXT_PUBLIC_MAP_ATTRIBUTION=...`
- `SEED_SECRET` only for demo operations if intentionally enabled

Store all secrets in Vercel environment variables, not in the repository.

## Build and deployment

```bash
npm run build
npm run start
```

For Vercel, use the platform's standard deployment flow with the repository connected to the project.

## Demo seeding

Demo seeding is intentionally restricted to development usage.

Do not enable this in production.

When demo data is needed in an isolated development environment:

1. Set `NODE_ENV=development`
2. Set `DEMO_MODE=true`
3. Set a strong `SEED_SECRET`
4. Send `x-seed-secret` header with the matching value to the seed endpoint
5. Ensure the request is made only by an administrator or trusted operator

## Security warnings

- Never commit real secrets or `.env.local` values.
- Do not expose server-only secrets in client code.
- Do not set `DEMO_MODE=true` in production.
- Do not allow ordinary users to trigger the seed route.
- Keep `NEXT_PUBLIC_` variables limited to public, non-sensitive values.
- Use HTTPS in production and keep cookies secure.

## Production defaults

```env
NODE_ENV=production
DEMO_MODE=false
SEED_ON_STARTUP=false
```
