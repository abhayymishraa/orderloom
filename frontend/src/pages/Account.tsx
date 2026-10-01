import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMe, getclosedtrades, getopentrades, type Me } from "../api/trade";
import { toDisplayPrice, toDisplayPriceUSD } from "../utils/utils";

/**
 * Account surface. Tactical-telemetry archetype: mono-dominant, uppercase
 * micro-type, 90-degree corners, hairline compartments, scanline material, and
 * one macro numeral carrying the whole page. Palette stays the app's own,
 * because red already means loss here (see the .tty note in index.css).
 */

interface ClosedTrade {
  orderId: string;
  type: "buy" | "sell";
  asset?: string;
  margin: number;
  leverage: number;
  openPrice: number;
  closePrice: number;
  pnl: number;
  closeTimestamp?: number;
  closeReason?: string;
}

interface OpenTrade {
  orderId: string;
  margin: number;
}

const money = (cents: number) =>
  toDisplayPriceUSD(cents).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const signed = (cents: number) => (cents >= 0 ? "+" : "-") + money(Math.abs(cents));

/** Uppercase mono field name. The only place positive tracking appears. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <dt className="num text-[10px] uppercase tracking-[0.18em] text-ink-faint">
      {children}
    </dt>
  );
}

/** Small-caps status pill. Accent dot + label, brutalist square corners. */
function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="num inline-flex shrink-0 items-center gap-1.5 border border-line-strong bg-raised px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-accent">
      <span className="h-1.5 w-1.5 bg-accent" aria-hidden />
      {children}
    </span>
  );
}

function Cell({
  label,
  children,
  tone,
  badge,
  updated,
}: {
  label: string;
  children: React.ReactNode;
  tone?: "long" | "short";
  badge?: string;
  updated?: string;
}) {
  return (
    <div className="tty-cross relative bg-surface px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <Key>{label}</Key>
        {badge && <StatusBadge>{badge}</StatusBadge>}
      </div>
      <dd
        className={`num mt-2.5 text-[19px] font-medium ${
          tone === "long" ? "text-long" : tone === "short" ? "text-short" : "text-ink"
        }`}
      >
        {children}
      </dd>
      {updated && (
        <p className="num mt-2 text-[9px] uppercase tracking-[0.14em] text-ink-faint">
          {updated}
        </p>
      )}
    </div>
  );
}

export default function Account() {
  const [me, setMe] = useState<Me | null>(null);
  const [closed, setClosed] = useState<ClosedTrade[]>([]);
  const [open, setOpen] = useState<OpenTrade[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    let alive = true;

    const load = async () => {
      try {
        const [account, hist, live] = await Promise.all([
          getMe(),
          getclosedtrades(token),
          getopentrades(token),
        ]);
        if (!alive) return;
        setMe(account);
        setClosed(hist?.data?.trades ?? []);
        setOpen(live?.data?.trades ?? []);
      } catch {
        if (!alive) return;
        // A bad or expired token is the only realistic failure here.
        localStorage.removeItem("token");
        navigate("/signin");
      }
    };

    load();
    const id = setInterval(load, 10000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [navigate]);

  const stats = useMemo(() => {
    const wins = closed.filter((t) => t.pnl > 0).length;
    const realised = closed.reduce((sum, t) => sum + t.pnl, 0);
    const committed = open.reduce((sum, t) => sum + t.margin, 0);
    const best = closed.reduce<number | null>(
      (b, t) => (b === null || t.pnl > b ? t.pnl : b),
      null,
    );
    const worst = closed.reduce<number | null>(
      (w, t) => (w === null || t.pnl < w ? t.pnl : w),
      null,
    );
    return {
      wins,
      realised,
      committed,
      best,
      worst,
      winRate: closed.length ? (wins / closed.length) * 100 : null,
    };
  }, [closed, open]);

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userID");
    navigate("/signin");
  };

  return (
    <div className="tty min-h-dvh bg-base text-ink">
      <div
        aria-hidden
        className="tty-scan pointer-events-none fixed inset-0 z-50 opacity-[0.35]"
      />

      <header className="flex items-center gap-4 border-b border-line px-4 py-2.5 sm:px-6">
        <Link to="/" className="flex items-baseline gap-2.5">
          <span className="grid h-5 w-5 place-items-center bg-accent text-[11px] font-bold text-[#04121f]">
            E
          </span>
          <span className="text-[13px] font-semibold tracking-tight">Orderloom</span>
        </Link>
        <nav className="num ml-auto flex items-center gap-1 text-[11px] uppercase tracking-[0.14em]">
          <Link
            to="/trading"
            className="px-3 py-1.5 text-ink-faint transition-colors hover:text-ink"
          >
            Terminal
          </Link>
          <span aria-current="page" className="bg-raised px-3 py-1.5 text-ink">
            Account
          </span>
          <button
            onClick={signOut}
            className="px-3 py-1.5 text-ink-faint uppercase tracking-[0.14em] transition-colors hover:text-short"
          >
            Sign out
          </button>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        {/* Masthead. The vault image carries the surface's identity; the type
            sits in the empty floor the prompt deliberately reserved. */}
        <section className="relative mt-6 border border-line">
          <img
            src="/img/account-vault.webp"
            alt="Clay model of an open strongroom, stacked discs on its shelves and a blue thread running in across the floor"
            className="h-[168px] w-full object-cover sm:h-[220px]"
          />
          {/* The scrim must survive a long local-part: at 70% the headline ran
              into the subject. Opaque across 55% of the width, then falls off. */}
          <div className="absolute inset-0 bg-gradient-to-r from-base from-30% via-base/88 via-55% to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
            <p className="num text-[10px] uppercase tracking-[0.28em] text-ink-faint">
              [ Account ]
            </p>
            <h1
              className="num mt-1.5 max-w-[62%] truncate text-[clamp(1.5rem,3.6vw,2.2rem)] font-semibold uppercase tracking-[-0.03em]"
              title={me?.email}
            >
              {me ? me.email.split("@")[0] : " "}
            </h1>
          </div>
        </section>

        {/* Balance: the reason this page exists, at macro scale. */}
        <section className="mt-px border border-line border-t-0 bg-surface px-4 py-6 sm:px-6 sm:py-8">
          <Key>Available balance</Key>
          {me ? (
            <p className="tty-mega mt-3 text-ink">
              <span className="text-ink-faint">$</span>
              {money(me.usd_balance)}
            </p>
          ) : (
            <div className="mt-3 h-16 w-72 max-w-full animate-pulse bg-raised" />
          )}
          <p className="num mt-3 text-[11px] uppercase tracking-[0.14em] text-ink-faint">
            {stats.committed > 0
              ? `$${money(stats.committed)} committed to ${open.length} open position${open.length === 1 ? "" : "s"}`
              : "No margin committed"}
          </p>
        </section>

        {/* Compartmentalised telemetry. gap-px over the line colour: the
            dividers are the gaps, so no cell carries a border. */}
        <dl className="mt-px grid gap-px border border-line border-t-0 bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Cell
            label="Realised P&L"
            tone={stats.realised === 0 ? undefined : stats.realised > 0 ? "long" : "short"}
            badge="Live"
            updated="Updated just now"
          >
            {closed.length ? signed(stats.realised) : "0.00"}
          </Cell>
          <Cell label="Positions closed">{closed.length}</Cell>
          <Cell label="Win rate">
            {stats.winRate === null ? "—" : `${stats.winRate.toFixed(0)}%`}
          </Cell>
          <Cell label="Open now">{open.length}</Cell>
          <Cell label="Best close" tone={stats.best !== null && stats.best > 0 ? "long" : undefined}>
            {stats.best === null ? "—" : signed(stats.best)}
          </Cell>
          <Cell label="Worst close" tone={stats.worst !== null && stats.worst < 0 ? "short" : undefined}>
            {stats.worst === null ? "—" : signed(stats.worst)}
          </Cell>
          <Cell label="Account email">
            <span className="text-[13px] break-all">{me?.email ?? "—"}</span>
          </Cell>
          <Cell label="Opened">
            <span className="text-[13px]">
              {me
                ? new Date(me.createdAt).toLocaleDateString("en-US", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </Cell>
        </dl>

        {/* History. Tabular, mono, one hairline between rows. */}
        <section className="mt-8">
          <div className="flex items-baseline justify-between border-b border-line pb-2">
            <h2 className="num text-[11px] uppercase tracking-[0.18em] text-ink-dim">
              Closed positions
            </h2>
            <span className="num text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              {closed.length} record{closed.length === 1 ? "" : "s"}
            </span>
          </div>

          {closed.length === 0 ? (
            <div className="border border-line border-t-0 bg-surface px-4 py-12 text-center">
              <p className="num text-[11px] uppercase tracking-[0.18em] text-ink-faint">
                No closed positions yet
              </p>
              <Link to="/trading" className="btn btn-primary mt-5 px-5 py-2.5 text-sm">
                Open the terminal
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto border border-line border-t-0">
              <table className="num w-full min-w-[640px] text-[12px]">
                <thead>
                  <tr className="border-b border-line bg-surface text-left">
                    {["Instrument", "Side", "Lev", "Entry", "Exit", "Closed by", "P&L"].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-faint ${
                            i > 1 ? "text-right" : ""
                          }`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {[...closed]
                    .sort((a, b) => (b.closeTimestamp ?? 0) - (a.closeTimestamp ?? 0))
                    .map((t) => (
                      <tr
                        key={t.orderId}
                        className="border-b border-line/60 bg-surface last:border-b-0 hover:bg-raised/60"
                      >
                        <td className="px-3 py-2.5 text-ink">
                          {(t.asset ?? "BTC").replace("USDT", "")}
                          <span className="text-ink-faint">/USDT</span>
                        </td>
                        <td
                          className={`px-3 py-2.5 uppercase ${
                            t.type === "buy" ? "text-long" : "text-short"
                          }`}
                        >
                          {t.type === "buy" ? "Long" : "Short"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-dim">
                          x{t.leverage}
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-dim">
                          {toDisplayPrice(t.openPrice).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-right text-ink-dim">
                          {toDisplayPrice(t.closePrice).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                          {(t.closeReason ?? "manual").replace("_", " ")}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-medium ${
                            t.pnl >= 0 ? "text-long" : "text-short"
                          }`}
                        >
                          {signed(t.pnl)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="num mt-10 text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Demo account &nbsp;///&nbsp; positions mark against live prices &nbsp;///&nbsp; no
          real funds
        </p>
      </main>
    </div>
  );
}
