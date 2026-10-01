

# Exness Trading Platform

A full-stack, real-time cryptocurrency trading dashboard featuring live market data streaming, interactive candlestick charts, secure authentication, and a comprehensive order management system with leverage, take-profit, and stop-loss support.

## 📦 Architecture & Services

The project is structured as a multi-service monorepo, orchestrated via Docker Compose:

| Service | Description | Runtime |
|---------|-------------|---------|
| `frontend` | React UI with real-time charting, order panels, and user dashboard | Vite + React 19 |
| `http_server` | REST API handling authentication, balance tracking, and trade execution | Express + Bun |
| `ws` | WebSocket server broadcasting live bid/ask prices to connected clients | `ws` + Bun |
| `price_poller` | Background worker fetching, aggregating, and storing market data | Prisma + Bun |
| `redis` | In-memory cache for pub/sub price streaming and session management | Redis 7.2.7 |
| `db` | Time-series relational database for trades and candlestick data | TimescaleDB (PostgreSQL 16) |

## 🛠 Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, `lightweight-charts`, React Router
- **Backend:** Express.js, Bun, TypeScript, Zod (validation), JSON Web Tokens
- **Real-time:** WebSockets (`ws`), Redis Pub/Sub
- **Database:** TimescaleDB (PostgreSQL), Prisma ORM
- **Infrastructure:** Docker & Docker Compose, GitHub Actions

## 📋 Prerequisites

- [Docker](https://www.docker.com/) & [Docker Compose](https://docs.docker.com/compose/)
- [Git](https://git-scm.com/)

## 🚀 Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/abhayymishraa/exness.git
   cd exness
   ```

2. Start all services using Docker Compose:
   ```bash
   docker compose up -d --build
   ```

   This will pull/build images, create the network, initialize Redis & TimescaleDB, and start all application services.

3. Verify services are running:
   ```bash
   docker compose ps
   ```

## 💻 Usage & Access

Once the containers are up, access the services at the following local ports:

| Service | Local URL | Description |
|---------|-----------|-------------|
| Frontend | `http://localhost:3000` | Trading dashboard & UI |
| REST API | `http://localhost:5000` | Backend API endpoints |
| WebSocket | `ws://localhost:8080` | Real-time price feed |
| Database | `localhost:5432` | TimescaleDB (CLI access) |

### Environment Configuration
The backend and database use environment variables. Defaults are configured in `docker-compose.yml`:
- `DJANGO_DB_USER` (default: `user`)
- `DJANGO_DB_PASS` (default: `XYZ@123`)
- `DJANGO_DB_NAME` (default: `trades_db`)

Override them by creating a `.env` file in the root directory or modifying the `docker-compose.yml` environment section.

### Local Development (Without Docker)
If you prefer running services natively:
```bash
# Frontend
cd frontend && npm install && npm run dev

# HTTP Server
cd http_server && bun install && bun run index.ts

# WebSocket Server
cd ws && bun install && bun run index.ts

# Price Poller
cd price_poller && bun install && bun prisma generate && bun run index.ts
```

## 📡 API & WebSocket Endpoints

### REST API (`/api/v1`)
- `POST /user/signup` & `/user/signin` - Authentication
- `GET /user/balance` - Fetch user balance
- `GET /asset` - List available trading pairs
- `GET /candles` - Retrieve historical candlestick data
- `GET /trades/open` & `GET /trades` - Fetch open/closed positions
- `POST /trade` - Open a new position (supports leverage, TP/SL)
- `POST /trade/close` - Close an existing position

### WebSocket (`ws://localhost:8080`)
- Broadcasts real-time `bid` and `ask` price updates for subscribed symbols.
- Frontend consumes updates via a subscription manager that feeds the charting library and order panels.

## 🌍 Deployment

This repository is configured with a GitHub Actions workflow (`.github/workflows/deploy.yml`) that automatically deploys to a Google Cloud Platform (GCP) Compute Engine VM.

**Triggers:**
- Push to `main` branch
- Manual workflow dispatch
- Bi-weekly scheduled runs

The workflow authenticates with GCP, ensures the target VM is running, clones the latest code, rebuilds Docker images with `--no-cache`, and brings up the stack in detached mode.

## 📁 Project Structure
```
exness/
├── docker-compose.yml       # Service orchestration
├── .github/workflows/       # CI/CD deployment pipeline
├── frontend/                # React + Vite UI
├── http_server/             # Express REST API
├── ws/                      # WebSocket price broadcaster
└── price_poller/            # Market data aggregation worker
```
