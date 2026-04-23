# Fillando — Frontend

3D printing filament platform. Built with Next.js App Router.

## Setup

```bash
cp .env.example .env   # fill in the values below
yarn install
yarn dev               # http://localhost:9000
```

## Environment variables

| Variable                   | Description                                       | Example                     |
| -------------------------- | ------------------------------------------------- | --------------------------- |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the backend API (must include `/api`) | `http://localhost:9001/api` |

The app validates this variable at startup via Zod (`src/env.ts`). A missing or malformed value throws immediately with a descriptive error.

## Commands

```bash
yarn dev        # Development server (port 9000)
yarn build      # Production build
yarn start      # Start production server
```

## Architecture & conventions

See [CLAUDE.md](./CLAUDE.md) for the full stack overview, directory structure, key patterns, and coding conventions.

## Docs

| File                                           | Contents                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| [docs/auth-flow.md](./docs/auth-flow.md)       | End-to-end auth flows (boot, login, OAuth, logout, token refresh) |
| [docs/http-service.md](./docs/http-service.md) | HTTP service usage, token refresh deduplication, Zod validation   |
