# mostly

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines React, TanStack Router, Hono, ORPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **TanStack Router** - File-based routing with full type safety
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Hono** - Lightweight, performant server framework
- **oRPC** - End-to-end type-safe APIs with OpenAPI integration
- **workers** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **SQLite/Turso** - Database engine
- **Authentication** - Better-Auth
- **Oxlint** - Oxlint + Oxfmt (linting & formatting)
- **PWA** - Progressive Web App support
- **Vite+** - Unified Vite toolchain, workspace task runner, linting, and formatting

## Getting Started

Install Node.js, pnpm, and the [Turso CLI](https://docs.turso.tech/cli/installation), then install dependencies.

```bash
pnpm install
```

Create `apps/server/.env.local` with `BETTER_AUTH_SECRET` (at least 32 random characters), `GOOGLE_CLIENT_ID`, and `GOOGLE_CLIENT_SECRET`. Generate the auth secret with `openssl rand -base64 32` and paste it into that file.

Register `http://localhost:3003/api/auth/callback/google` as an authorized redirect URI on your Google OAuth web client.

Start the local database in a separate terminal.

```bash
pnpm run db:local
```

The default development database URL is `http://127.0.0.1:8080`. Local Turso needs no auth token. For a hosted database, set `DATABASE_URL` and `DATABASE_AUTH_TOKEN` in `apps/server/.env.local` instead.

Apply the committed migrations, then start the app.

```bash
pnpm run db:migrate
pnpm run dev
```

Open [http://localhost:3003](http://localhost:3003). Alchemy starts Vite on port `3003` and the API Worker on port `3004`. The browser sends `/api` and `/rpc` requests through Vite, so sign-in and application requests share one browser origin. `BETTER_AUTH_URL` and `CORS_ORIGIN` default to `http://localhost:3003` during development. Explicit values in env files take precedence.

Development state is stored locally under `packages/infra/.alchemy`. Local app startup uses Alchemy's local Cloudflare providers and needs no Cloudflare profile. Deployment uses the configured Cloudflare state store and provider credentials. Existing cloud-backed development state is retained when switching to this local state store.

Ports `3003` and `3004` are fixed because the proxy and registered OAuth callback depend on them. Startup reports a port conflict instead of silently moving to another port.

For separate frontend and backend terminals, run `pnpm run dev:server` followed by `pnpm run dev:web`. The frontend command starts bare Vite and uses the same API proxy.

### Phone and PWA testing

Set `DEV_PUBLIC_ORIGIN` to the HTTPS origin you open on your phone, for example `https://your-machine.your-tailnet.ts.net:8083`. Set it in `apps/server/.env.local`, or pass it when starting development.

```bash
DEV_PUBLIC_ORIGIN=https://your-machine.your-tailnet.ts.net:8083 pnpm run dev
```

Use Caddy or another HTTPS reverse proxy to forward that origin to `http://localhost:3003`. Vite forwards API traffic to the Worker. The public origin supplies the Vite allowed host and CORS origin, and the default auth and trusted origins. If you already set `BETTER_AUTH_URL` or `CORS_ORIGIN`, remove those development overrides to use the shared default, or set both to the public origin.

Register `<DEV_PUBLIC_ORIGIN>/api/auth/callback/google` with Google as well. Restart development after changing env values. With bare Vite, pass `DEV_PUBLIC_ORIGIN` to `pnpm run dev:web` too.

Service workers are opt-in during development to avoid cached app shells while editing. Enable them for offline or push testing.

```bash
DEV_PWA=true pnpm run dev
```

If an earlier dev session registered a service worker, unregister it in browser developer tools once. Production builds always include the service worker.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@mostly/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Sign-in

Google is the only sign-in method. Create a Google OAuth web client and add `<BETTER_AUTH_URL>/api/auth/callback/google` as an authorized redirect URI, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `apps/server/.env.local`. Only `openid`, `email`, and `profile` scopes are requested.

On an iOS standalone PWA the OAuth page opens in the system browser and returns to `/today`, so the sign-in flow finishes outside the installed app.

## Environment Configuration

Each app owns its environment schema in `.env.schema`. Varlock generates `src/env.ts` during installation; run `pnpm run env:generate` after changing a schema. Commit schemas, and keep secrets in ignored env files or your deployment platform.

Workers read native bindings through `apps/server/src/env.server.ts`. The browser reads public configuration through `apps/web/src/env.public.ts`, which uses the current page origin in development. Standalone tools can import the generated `ENV` accessor. Shared database and auth packages receive configuration or initialized clients from the application. See [Varlock's monorepo guide](https://varlock.dev/guides/monorepos/).

The infra package imports the server's env schema. Its dev, deploy, and destroy scripts validate and inject values once through `varlock run --inject vars` before Alchemy starts. Use those package scripts when passing Alchemy flags so validation also runs. Alchemy supplies resource URLs and passes the configured database credentials into the Worker. In-Worker Varlock protections are deferred until an official Alchemy integration is available. See [the non-Wrangler deployment guidance](https://varlock.dev/integrations/cloudflare/#non-wrangler-deploy-tools-alchemy-sst-pulumi).

Bun's automatic env loading is disabled in `bunfig.toml`; the framework integration or server bootstrap loads Varlock. Node deployments must include Varlock and its dependencies alongside the app schema.

Run standalone Node/Bun tools that use Varlock from the owning app directory so they load that app's schema and env files. `env:generate` only generates TypeScript files; it does not initialize environment values in a subsequent command.

## Deployment

### Alchemy

- Target: web on Cloudflare + server on Cloudflare
- Configure provider accounts: `cd packages/infra && pnpm exec alchemy profile edit`
- Dev: pnpm run dev
- Deploy: pnpm run deploy
- Destroy: pnpm run destroy

Configure the Cloudflare profile for deployment. Profiles are stored under `~/.alchemy`.

Development runs with `NODE_ENV=development` and defaults to a `dev_<username>` stage. Deploy and destroy run with `NODE_ENV=production` and default to a `live_<username>` stage. Use an explicit stage for production.

```bash
pnpm run deploy --stage production
```

### Production origins

Set `BETTER_AUTH_URL` to the deployed API origin and `CORS_ORIGIN` to the deployed web origin in `apps/server/.env.production.local`, along with production credentials. These origins and database credentials are required in production. The web build receives the deployed API URL from Alchemy. Once the deployment URLs are known, update the origins and deploy again. Register the production Google callback URL too.

## Git Hooks and Formatting

- Optional native Vite+ hooks: `pnpm run hooks:setup`
- Docs: [Vite+ commit hooks](https://viteplus.dev/guide/commit-hooks)
- Run checks: `pnpm run check`

## Project Structure

```
mostly/
├── apps/
│   ├── web/         # Frontend application (React + TanStack Router)
│   └── server/      # Backend API (Hono, ORPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── domain/      # Pure time and stats rules (injected clock and timezone)
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm run dev`: Start all applications in development mode
- `pnpm run build`: Build all applications
- `pnpm run dev:web`: Start only the web application
- `pnpm run dev:server`: Start only the server
- `pnpm run check-types`: Check TypeScript types across all apps
- `pnpm run test`: Run the Vitest suite across the workspace
- `pnpm run db:push`: Push schema changes to database
- `pnpm run db:generate`: Generate database client/types
- `pnpm run db:migrate`: Run database migrations
- `pnpm run db:studio`: Open database studio UI
- `pnpm run db:local`: Start the local SQLite database
- `pnpm run check`: Run Vite+ format/lint checks and workspace TypeScript checks
- `pnpm run lint`: Run Vite+ lint checks
- `pnpm run format`: Run Vite+ formatting
- `pnpm run staged`: Run Vite+ checks against staged files
- `pnpm run hooks:setup`: Install Vite+ native Git hooks with `vp config`
- `cd apps/web && pnpm run generate-pwa-assets`: Generate PWA assets
