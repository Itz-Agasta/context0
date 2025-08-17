# Context0 API

A semantic memory API service powered by vector embeddings and blockchain storage. Context0 provides memory management with AI-powered vector search (EizenDB), persistent storage on Arweave, Redis caching, and user/subscription management for Context0 project.

## Overview

- Framework: Express.js + TypeScript
- Vector DB: EizenDB (HNSW)
- Embeddings: Xenova-based embedding service (local/in-process)
- Database: PostgreSQL (Drizzle ORM)
- Cache: Redis
- Auth: JWT (middleware) — Clerk integration expected for user lifecycle
- Storage: Arweave for contract deployment
- Validation: Zod

## Project layout (important files)

```
API/
├── src/
│   ├── server.ts
│   ├── config/           # arlocal, arweave, redis
│   ├── db/               # Drizzle DB and schema
│   ├── middlewares/      # auth, validate, contract, errorHandler
│   ├── routes/           # api routes (memories, deploy, admin, health, webhook, instances, subscriptions)
│   ├── schemas/          # Zod request schemas
│   ├── services/         # EizenService, MemoryService, DeployService, EmbeddingService, SubscriptionService
│   └── utils/            # helpers and response formatters
```

## Runtime behavior / authentication

- Most user-facing endpoints require a valid JWT. The `auth` middleware extracts `userId` from the token and attaches it to `req.userId`.
- Some routes (admin endpoints) are only intended for internal/admin use and require authentication as well.
- Memory operations are multi-tenant: each memory operation must be executed against an Eizen contract associated with a user (contract id is stored/managed per user).

## API Endpoints (current)

Note: Most routes live under `/api` when served by `server.ts` (check your express mount path).

- Health

  - GET /health — Basic health
  - GET /health/detailed — Detailed system health (uses fallback admin contract if configured)
  - GET /health/eizen — Eizen vector DB health
  - GET /health/memory — Memory service health

- Deploy

  - POST /deploy — Deploy a new Eizen contract for an authenticated user (uses `DeployService.deployForUser`)
  - GET /deploy/status — Check deployment status for the authenticated user (`DeployService.getDeploymentStatus`)

- Memories (user-facing)

  - POST /memories/insert — Create a memory (text -> embedding -> store in Eizen). Requires contract verification middleware.
  - GET /memories/search — Query string search (`?query=...&k=10&filters=...`). Requires contract verification.
  - POST /memories/search — Body-based search (useful for complex filters). Requires contract verification.
  - GET /memories/search/:id — Retrieve a memory by its vector ID. Requires contract verification.
  - GET /memories — Memory statistics for the contract. Requires contract verification.

- Instances / Keys

  - GET /instances — List instances (keys) for authenticated user (requires `auth`)
  - POST /instances/create — Create a new instance (key) for the authenticated user (requires `auth`)

- Subscriptions

  - GET /subscriptions — Get subscription for authenticated user (requires `auth`)
  - POST /subscriptions — Create subscription for authenticated user (requires `auth`)

- Admin

  - POST /admin/insert — Admin memory insert for a specified contract (requires `auth`)
  - POST /admin/search — Admin memory search for a specified contract (requires `auth`)
  - GET /admin/memories/count/:contractId — Get memory count for a contract
  - POST /admin/deploy — Deploy a new Eizen contract (admin)
  - POST /admin/test-deploy — Test the deployForUser flow (admin)
  - GET /admin/test-deploy-status — Test getDeploymentStatus for a provided userId (admin)

- Webhooks
  - POST /webhook/clerk/registered — Clerk registration webhook (creates user)
  - POST /webhook/payments/web3 — Web3 payment webhook (verifies tx, creates/updates subscription)

## Request/Response patterns

- Success responses use a unified `successResponse(data, message)` format exported from `src/utils/responses.ts`.
- Errors use `errorResponse(title, message)` and standard HTTP status codes.
- Request validation uses Zod schemas in `src/schemas` and `validate` middleware.

## Environment variables

Minimum required variables used by the API (add to `.env` in API root):

- DATABASE_URL — PostgreSQL connection string (required)
- REDIS_URL — Redis connection string (required)
- NODE_ENV — Environment (defaults to `development`)
- PORT — Server port (default: 3000)
- ORIGIN — Allowed CORS origins (comma-separated)
- CONTRACT_JWT_SECRET — JWT secret used to sign/verify tokens (required in production)
- EMAIL_SERVICE_USER — SMTP user for transactional emails
- EMAIL_SERVICE_PASS — SMTP password
- EIZEN_M — HNSW M parameter (default 16)
- EIZEN_EF_CONSTRUCTION — HNSW efConstruction (default 200)
- EIZEN_EF_SEARCH — HNSW efSearch (default 50)
- EIZEN_CONTRACT_ID — Optional admin fallback Eizen contract used for system health checks
- SERVICE_WALLET_ADDRESS — Optional service wallet address presence flag
- ARWEAVE_GATEWAY — Optional gateway used for Arweave interactions

Do not commit secrets to source control.

## Development

1. Enter API folder:

```bash
cd API
```

2. Install dependencies:

```bash
bun install
```

3. Common workflows

- Start development server (watch mode):

```bash
bun run dev
```

- Build TypeScript for production:

```bash
bun run build
```

- Start the built production server:

```bash
bun run start
```

- Clean build artifacts:

```bash
bun run clean
```

- Format code (Ultracite):

```bash
bun run format
```

- Run linter in CI mode (Biome):

```bash
bun run check:ci
```

- Database helper scripts (Drizzle):

```bash
bun run db:gen      # generate migrations/schema
bun run db:migrate  # run migrations
bun run db:studio   # open Drizzle Studio
```

You can also run the underlying CLI directly with Bun's `bunx` if needed, e.g. `bunx drizzle-kit generate`.

## Docker

Build and run the API image (ensure dependencies and a dev-wallet are installed before building):

```bash
bun install # This is necessary because a dev-wallet is mandatory for interact with Arweave

docker build -t context0-api .
docker run -p 3000:3000 --env-file .env context0-api
```

## Webhook integrations

- Clerk: `POST /webhook/clerk/registered` is used to create users on registration events.
- Web3 payments: `POST /webhook/payments/web3` verifies transaction hashes (via Etherscan helper) and creates or updates subscriptions.

## Notes & Migration considerations

- The API enforces multi-tenant memory operations by associating each user with a deployed Eizen contract. Memory routes typically use the `verifyContractHashMiddleware` to ensure the provided contract is valid.
- Admin routes can operate directly against a provided `contractId` in request bodies for testing and maintenance.
- Authentication/authorization flows rely on a JWT-based `auth` middleware; Clerk is expected to manage user authentication in production deployments.
