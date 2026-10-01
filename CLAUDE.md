# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

A leveraged crypto trading platform ("exness" clone) built as four independent
Bun/TypeScript services plus a React frontend. Users open leveraged BTC/ETH/SOL
positions against live Binance prices, tracked with real-time P&L, take-profit,
stop-loss, and liquidation.

## Services

| Dir | Role | Runtime |
|---|---|---|
| `frontend/` | React 19 + Vite + Tailwind v4 trading UI (landing, `/trading`, `/account`, auth) | Bun/Node, browser |
| `http_server/` | REST API: auth, orders, trades, assets, candles. Owns account/position state | Bun + Express |
| `price_poller/` | Subscribes to Binance `aggTrade` websocket, batches ticks into TimescaleDB, publishes to Redis | Bun |
| `ws/` | Thin pub/sub relay: forwards Redis price channels (`BTC`/`ETH`/`SOL`) to subscribed browser websocket clients | Bun |
| `deploy/` | Bare-metal deploy scripts (rsync + systemd + Caddy on one Oracle VM). No Docker in prod | bash |

Data flow: Binance ws -> `price_poller` -> Redis (pub/sub + latest-price store) and
TimescaleDB (trade history) -> `ws` relays live prices to the frontend, `http_server`
reads/writes orders and reads price state to compute PnL/liquidation.

Two separate Postgres databases, on purpose (see comment atop
`http_server/prisma/schema.prisma`): `http_server` uses Neon (small, durable,
accounts/orders) via `NEON_DATABASE_URL`/`NEON_DIRECT_URL`; `price_poller` uses
local TimescaleDB (`DATABASE_URL`) for high-volume trade ticks/hypertables. Don't
merge these schemas or point one service at the other's database.

## Running locally

Each service is a standalone Bun project (`bun install`, `bun run index.ts` per
its own README). For the full stack, `docker-compose.yml` at the repo root wires
up `web`, `backend` (http_server), `poller` (price_poller), `ws`, `redis`, and
`db` (TimescaleDB) together — that's the fastest way to get everything talking.

Frontend: `cd frontend && bun install && bun run dev` (Vite dev server).

## Conventions worth knowing

- **Prices are integers, not floats.** Prices/quantities are scaled (see
  `PRICE_SCALE` / `toInternalPrice` / `toDisplayPrice` in each service's
  `utils.ts`) and stored as `BigInt` cents in Postgres — BTC's price alone can
  overflow `int4`, and leveraged PnL can too. Never introduce raw floating-point
  money math; go through the existing scale/display helpers.
- **Money/precision helpers are duplicated** between `frontend/src/utils/utils.ts`
  and `http_server/src/utils/utils.ts` (e.g. `calculatePnlCents`,
  `toDisplayPrice`) rather than shared — keep both in sync if you change the
  scaling logic, don't assume editing one updates the other.
- `http_server` rebuilds its in-memory order/user state from Neon on boot
  (`loadState()` in `store.ts`) before mounting routes — in-memory maps
  (`USERS`, `ORDERS`, `CLOSEDORDERS`, `PRICESTORE` in `data/index.ts`) are the
  source of truth at request time, Postgres is the durability layer.
- The design system is documented in `DESIGN.md` — read it before touching
  anything under `frontend/src/components` or `frontend/src/index.css`. Key hard
  rules: one accent color, green/red (`long`/`short`) are reserved for real P&L
  data only (never decorative), no em-dashes in UI strings, money always renders
  with two decimals and thousands separators, `min-h-dvh` never `h-screen`.
- Vendored third-party components live in `frontend/src/components/magicui/`
  (from the Magic UI registry) — these are intentionally locally owned/edited
  copies, not npm dependencies; DESIGN.md documents what was changed and why.

## Tests

- `http_server` has Bun test files (`src/utils/cors.test.ts`,
  `src/utils/utils.test.ts`) — run with `bun test` from `http_server/`.
- No test suites exist yet for `price_poller`, `ws`, or `frontend`.

## Deploy

Production is not Docker — see `deploy/README.md`. `docker-compose.yml` is for
local dev only. `.github/workflows/deploy.yml` rsyncs and restarts systemd
services on the Oracle VM on every push to `main`; there is no CI test/build gate
before that deploy, so be extra careful with anything merged to `main`.
