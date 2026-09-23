import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ChartComponent from "../components/Chart";
import { Channels, Duration } from "../utils/constants";
import type { SYMBOL } from "../utils/constants";
import AskBids from "../components/AskBidsTable";
import { findUserAmount } from "../api/trade";
import OrdersPanel from "../components/OrdersPanel";
import BuySell from "../components/BuySell";
import { PiUserCircle } from "react-icons/pi";
import { toDisplayPrice, toDisplayPriceUSD } from "../utils/utils";

const PAIRS: { symbol: SYMBOL; label: string }[] = [
  { symbol: Channels.BTCUSDT, label: "BTC/USDT" },
  { symbol: Channels.ETHUSDT, label: "ETH/USDT" },
  { symbol: Channels.SOLUSDT, label: "SOL/USDT" },
];

const TIMEFRAMES: { value: Duration; label: string }[] = [
  { value: Duration.candles_1m, label: "1m" },
  { value: Duration.candles_1d, label: "1d" },
  { value: Duration.candles_1w, label: "1w" },
];

export default function Trading() {
  const [duration, setDuration] = useState<Duration>(Duration.candles_1m);
  const [symbol, setSymbol] = useState<SYMBOL>(Channels.BTCUSDT);
  const [prices, setPrices] = useState({ askPrice: 0, bidPrice: 0 });
  const [balance, setBalance] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // This call already ran for the auth check and threw the figure away. The
    // header now shows it, so no second poller is needed.
    async function checkdata() {
      try {
        const data = await findUserAmount();
        if (data.usd_balance === undefined) {
          localStorage.removeItem("token");
          navigate("/signin");
          return;
        }
        setBalance(data.usd_balance);
      } catch (error) {
        console.error("Error fetching user data:", error);
        navigate("/signin");
      }
    }
    checkdata();
    const id = setInterval(checkdata, 10000);
    return () => clearInterval(id);
  }, [navigate]);

  const signOut = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userID");
    navigate("/signin");
  };

  return (
    <div className="flex h-dvh flex-col bg-base text-ink">
      {/* The previous shell had no way out of the terminal — no home link, no
          sign out. */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5">
        <Link to="/" className="flex items-baseline gap-2.5">
          <span className="grid h-5 w-5 place-items-center bg-accent text-[11px] font-bold text-[#04121f]">
            E
          </span>
          <span className="text-[13px] font-semibold tracking-tight">Orderloom</span>
        </Link>

        <nav aria-label="Instrument" className="flex items-center gap-1">
          {PAIRS.map((p) => {
            const active = symbol === p.symbol;
            return (
              <button
                key={p.symbol}
                onClick={() => setSymbol(p.symbol)}
                aria-current={active ? "true" : undefined}
                className={`num rounded-[3px] px-3 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-accent/15 text-accent"
                    : "text-ink-dim hover:bg-raised hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5 rounded-[3px] border border-line p-0.5">
          {TIMEFRAMES.map((t) => {
            const active = duration === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setDuration(t.value)}
                aria-current={active ? "true" : undefined}
                className={`num rounded-[2px] px-2.5 py-1 text-[12px] font-medium transition-colors ${
                  active ? "bg-raised text-ink" : "text-ink-faint hover:text-ink"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Balance was only visible inside the trade ticket, so it vanished the
            moment you looked at positions or the chart. It reads as a figure,
            not a control: a clickable number gives no affordance, so the way to
            the account lives in its own labelled button beside it. */}
        <div className="flex items-baseline gap-2 border border-line px-3 py-1">
          <span className="label">Balance</span>
          {balance === null ? (
            <span className="inline-block h-4 w-16 animate-pulse bg-raised align-middle" />
          ) : (
            <span className="num text-[13px] font-medium text-ink">
              $
              {toDisplayPriceUSD(balance).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
          )}
        </div>

        <Link
          to="/account"
          className="btn btn-ghost gap-1.5 px-3 py-1.5 text-[13px]"
        >
          <PiUserCircle size={15} aria-hidden />
          My profile
        </Link>

        <button
          onClick={signOut}
          className="text-[13px] text-ink-faint transition-colors hover:text-ink"
        >
          Sign out
        </button>
      </header>

      {/* gap-px over a line-coloured background: the 1px gaps ARE the dividers,
          so no panel carries its own border. */}
      <div className="grid min-h-0 flex-1 gap-px bg-line lg:grid-cols-[280px_1fr_344px]">
        <aside className="order-2 min-h-0 min-w-0 overflow-auto bg-surface lg:order-1">
          <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
            <h2 className="label">Order book</h2>
            <span className="flex items-center gap-1.5 text-[10px] text-ink-faint">
              <span className="h-1.5 w-1.5 rounded-full bg-long" />
              live
            </span>
          </div>
          <AskBids symbol={symbol} />
        </aside>

        <section className="order-1 flex min-h-0 min-w-0 flex-col gap-px bg-line lg:order-2">
          <div className="min-h-0 flex-[3] bg-surface">
            <ChartComponent
              symbol={symbol}
              duration={duration}
              onPriceUpdate={setPrices}
            />
          </div>
          <div className="min-h-0 flex-[2] overflow-auto bg-surface">
            <OrdersPanel />
          </div>
        </section>

        <aside className="order-3 min-h-0 min-w-0 overflow-auto bg-surface">
          <BuySell
            symbol={symbol}
            askPrice={toDisplayPrice(prices.askPrice)}
            bidPrice={toDisplayPrice(prices.bidPrice)}
          />
        </aside>
      </div>
    </div>
  );
}
