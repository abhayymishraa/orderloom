# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Exness is a crypto perpetuals/leveraged-trading demo platform (BTC/ETH/SOL) made of four independently deployable services plus a shared design system:

- `frontend/` — React 19 + Vite + TypeScript + Tailwind v4 trading UI (landing page, `/trading`, `/account`, auth).
- `http_server/` — Bun + Express REST API: users/auth, orders, trades, assets, candles. Runs `bun run index.ts`.
- `ws/` — Bun WebSocket server that fans out live prices to browser clients via Redis pub/sub. Runs `bun run index.ts`.
- `price_poller/` — Bun service that connects to the Binance aggTrade stream, publishes ticks to Redis, and batches trades into TimescaleDB. Runs `bun run index.ts`.

## Commands

Each service (`http_server`, `ws`, `price_poller`) is an independent Bun project — `cd` into it first.

```bash
bun install                 # install deps for a service
bun run index.ts            # run a service directly (http_server/ws/price_poller)
bun test                    # run tests (http_server; e.g. bun test src/utils/cors.test.ts for one file)
```

Frontend (`cd frontend`):

```bash
npm install
npm run dev                 # vite dev server
npm run build                # tsc -b && vite build
npm run lint                 # eslint .
```

Prisma (`http_server` and `price_poller` each have their own `prisma/schema.prisma`):

```bash
bunx prisma generate
bunx prisma migrate dev     # http_server only (has a migrations/ dir); price_poller's Trade table is unmigrated/hypertable-managed
```

Full local stack (Postgres/TimescaleDB, Redis, all four services) via Docker Compose:

```bash
docker compose up
```

## Architecture

**Two separate Postgres databases, on purpose** (see comment at the top of `http_server/prisma/schema.prisma`):
- **Neon** (`http_server/prisma/schema.prisma`, env `NEON_DATABASE_URL`/`NEON_DIRECT_URL`) holds `User`, `Order`, `ClosedOrder` — small, must outlive the box, no hypertable needed. Money fields are `BigInt` cents scaled by `PRICE_SCALE` (1e4) because BTC prices over ~$214k overflow `int4` and leveraged PnL can too.
- **TimescaleDB** (`price_poller/prisma/schema.prisma`, env `DATABASE_URL`) holds raw `Trade` ticks from Binance — a hypertable, high write volume, local to the box.

**Price flow**: `price_poller` connects to Binance's `wss://stream.binance.com:9443/ws` aggTrade feed, converts external prices to internal fixed-point (`toInternalPrice`), and does two things per tick: publishes to Redis (`pushToRedis`) for real-time fanout, and buffers into `tradeBatch`, flushed to TimescaleDB every 10s (`savetradeBatch`) or on stream close. Binance drops the stream routinely — on `ws.on("close")`, the process flushes and calls `process.exit(1)` rather than reconnecting in-process; systemd/Docker restart policy is the reconnect strategy.

**Redis pub/sub is the backbone between services**, not just a cache:
- `ws/index.ts` subscribes to `Channels = ["SOL", "ETH", "BTC"]` and re-broadcasts each message verbatim to browser WebSocket clients that have `SUBSCRIBE`d that symbol (per-connection `Map<WebSocket, Set<string>>` of subscribed symbols).
- `http_server/src/index.ts` also subscribes to the same channels on startup (`startpriceuddate`) to keep an in-memory `PRICESTORE` up to date and to run `checkOpenPositions` (take-profit/stop-loss/liquidation checks) on every price tick. A failed position check is caught and logged rather than thrown, since an unhandled rejection inside a redis subscriber callback is fatal in Bun.

**`http_server` keeps working state in memory, backed by Neon**: `USERS`, `ORDERS`, `CLOSEDORDERS`, `PRICESTORE` (`http_server/src/data/index.ts`) are in-memory maps. `loadState()` (`http_server/src/store.ts`) rebuilds them from Neon before any route is mounted — without it, requests would see empty state as if every account vanished. Writes go to both the in-memory maps and Neon.

**Routes** are mounted under `/api/v1/{trades,trade,user,candles,asset}` in `http_server/src/index.ts`, each in its own file under `http_server/src/router/`.

**Frontend price plumbing** mirrors the WS protocol: `frontend/src/utils/subscription_manager.ts` (`Signalingmanager`) sends `SUBSCRIBE`/`UNSUBSCRIBE` messages and dispatches incoming ticks; `frontend/src/utils/price_store.ts` holds live prices and notifies subscribers (`subscribePrices`); `frontend/src/utils/chart_agg_ws_api.ts` aggregates ticks into candles client-side for the chart.

## Design system

`DESIGN.md` at the repo root is the authoritative frontend design spec — read it before touching anything under `frontend/src/`. Key rules to not violate:
- One dark theme, one accent (`accent` `#158bf9`). Green/red (`long`/`short`) are reserved for P&L direction data, never decoration.
- Tokens live in `frontend/src/index.css` under Tailwind v4 `@theme`; use the resulting utilities (`bg-surface`, `text-ink-dim`, etc.) rather than hardcoding colors.
- Numbers use `Geist Mono` with `.num` (tabular figures) so digits don't jitter; money always renders two decimals with thousands separators; no invented figures — every number on screen comes from the API or is labelled.
- No drop shadows (hairline + surface shift instead), radius is 4px app-wide except `.tty` (account surface) which is 0px.
- Vendored Magic UI components live in `frontend/src/components/magicui/`; these are owned copies, local edits expected. Any new one must unmount (not just slow down) under `prefers-reduced-motion` — none of the vendored ones ship a reduced-motion branch internally, it's gated at the call site.
- Zero em-dashes in user-visible strings. `min-h-dvh`, never `h-screen`. Never `window.addEventListener('scroll')` — use motion values, `whileInView`, or CSS.

## Deploy

See `deploy/README.md`. Frontend is on Vercel; `http_server`, `ws`, and `price_poller` run as systemd services (no Docker) on a single Oracle box behind Caddy, deployed via `deploy/deploy.sh` (`rsync && bun install && systemctl restart`). `.github/workflows/deploy.yml` runs that deploy script on every push to `main`.
