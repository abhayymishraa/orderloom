import { Link } from "react-router-dom";

/**
 * Shared chrome for sign in / sign up — the two pages were ~90% identical.
 * Split layout: the form sits on a raised panel to the left of a quiet
 * marketing rail, so neither page is a lone centred card on a dark field.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-base text-ink">
      <div aria-hidden className="grid-field pointer-events-none fixed inset-0" />

      <div className="relative mx-auto flex min-h-dvh max-w-5xl flex-col px-5 sm:px-8">
        <header className="py-5">
          <Link to="/" className="inline-flex items-baseline gap-2.5">
            <span className="grid h-6 w-6 place-items-center bg-accent text-[13px] font-bold text-[#04121f]">
              E
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Orderloom</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center py-10">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-20">
            <div className="rise">
              <h1 className="text-[2rem] font-semibold">{title}</h1>
              <p className="mt-2.5 text-[15px] text-ink-dim">{subtitle}</p>

              <div className="mt-8">{children}</div>

              <div className="mt-6 border-t border-line pt-5 text-[13px] text-ink-dim">
                {footer}
              </div>
            </div>

            {/* Quiet rail. Facts about the product, not testimonials. */}
            <aside
              className="rise hidden self-center lg:block"
              style={{ animationDelay: "120ms" }}
            >
              <dl className="space-y-px bg-line">
                {[
                  ["Starting balance", "$5,000 demo"],
                  ["Markets", "BTC · ETH · SOL"],
                  ["Price source", "Binance spot, live"],
                  ["Deposit required", "None"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-baseline justify-between gap-6 bg-surface px-5 py-4"
                  >
                    <dt className="text-[13px] text-ink-dim">{k}</dt>
                    <dd className="num text-[13px] font-medium text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 max-w-[38ch] text-[12px] leading-relaxed text-ink-faint">
                A demo account. Positions mark against live prices, but no real
                funds are traded.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
