import { useEffect, useMemo, useState } from "react";
import { closetrade, getclosedtrades, getopentrades } from "../api/trade";
import {
  calculatePnlCents,
  toDisplayPrice,
  toDisplayPriceUSD,
} from "../utils/utils";
import { subscribePrices, type LivePrices } from "../utils/price_store";

/** Cents -> a money string. Always two decimals, thousands separated. */
const money = (cents: number) =>
  toDisplayPriceUSD(cents).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

interface OpenOrder {
  orderId: string;
  type: "buy" | "sell";
  margin: number;
  leverage: number;
  openPrice: number;
  asset?: string;
  takeProfit?: number;
  stopLoss?: number;
  liquidationPrice?: number;
}

interface ClosedOrder extends OpenOrder {
  closePrice: number;
  pnl: number;
}

type OpenOrderWithPnl = OpenOrder & { pnlUsd: number };

type RowStatus = "normal" | "warning" | "executed";

const ROW_STATUS_LABEL: Record<RowStatus, string> = {
  normal: "Active",
  warning: "Near trigger",
  executed: "Triggered",
};

const ROW_STATUS_CLASS: Record<RowStatus, string> = {
  normal: "border-line-strong text-ink-faint",
  warning: "border-yellow-500/40 text-yellow-500",
  executed: "border-long/40 text-long",
};

/** Small uppercase pill, consistent with the app's `.label` type. */
function StatusBadge({ status }: { status: RowStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] ${ROW_STATUS_CLASS[status]}`}
    >
      {status === "warning" && (
        <span className="h-1 w-1 rounded-full bg-yellow-500" />
      )}
      {ROW_STATUS_LABEL[status]}
    </span>
  );
}

export default function OrdersPanel() {
  const [activeTab, setActiveTab] = useState<"open" | "closed">("open");
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [closedOrders, setClosedOrders] = useState<ClosedOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClosingPosition, setIsClosingPosition] = useState<string | null>(
    null
  );
  const [latestPrices, setLatestPrices] = useState<LivePrices>({
    BTC: { bid: 0, ask: 0 },
    ETH: { bid: 0, ask: 0 },
    SOL: { bid: 0, ask: 0 },
  });

  const fetchOpenOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getopentrades(token);
      setOpenOrders(response?.data.trades || []);
    } catch (error) {
      console.error("Error fetching open orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClosedOrders = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token") || "";

      const response = await getclosedtrades(token);
      setClosedOrders(response.data.trades || []);
    } catch (error) {
      console.error("Error fetching closed orders:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "open") {
      fetchOpenOrders();
    } else {
      fetchClosedOrders();
    }

    // Set up polling to refresh data
    const intervalId = setInterval(() => {
      if (activeTab === "open") {
        fetchOpenOrders();
      } else {
        fetchClosedOrders();
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [activeTab]);

  useEffect(() => {
    const unsubscribe = subscribePrices((p: LivePrices) => {
      setLatestPrices(p);
    });
    return () => unsubscribe();
  }, []);

  const openWithPnl: OpenOrderWithPnl[] = useMemo(() => {
    return openOrders.map((o): OpenOrderWithPnl => {
      const sym = (o.asset || "BTC").replace("USDT", "");
      const p = latestPrices[sym as keyof LivePrices];
      if (!p || p.bid === 0 || p.ask === 0) {
        return { ...o, pnlUsd: 0 };
      }

      // Long marks against the bid, short against the ask - the same sides the
      // server closes at, so this preview equals the realised figure.
      const currentcloseprice = o.type === "buy" ? p.bid : p.ask;
      const raw = calculatePnlCents({
        side: o.type,
        openPrice: o.openPrice,
        closePrice: currentcloseprice,
        marginCents: o.margin,
        leverage: o.leverage,
      });
      // Clamp to match closeOrder: a position cannot lose more than its margin,
      // so an unclamped preview would promise a loss the close never takes.
      return { ...o, pnlUsd: Math.max(raw, -o.margin) };
    });
  }, [openOrders, latestPrices]);

  // Compact summary for the header strip: what's committed and how it's doing,
  // without having to scan every row.
  const openSummary = useMemo(
    () => ({
      margin: openOrders.reduce((sum, o) => sum + o.margin, 0),
      pnl: openWithPnl.reduce((sum, o) => sum + o.pnlUsd, 0),
    }),
    [openOrders, openWithPnl],
  );

  // Helper function to get TP/SL status
  const getTpSlStatus = (order: OpenOrderWithPnl) => {
    const sym = (order.asset || "BTC").replace("USDT", "");
    const p = latestPrices[sym as keyof LivePrices];
    if (!p) return { tpStatus: "none", slStatus: "none" };

    const currentPrice = order.type === "buy" ? p.bid : p.ask;

    let tpStatus = "none";
    let slStatus = "none";

    if (order.takeProfit) {
      if (order.type === "buy" && currentPrice >= order.takeProfit) {
        tpStatus = "hit";
      } else if (order.type === "sell" && currentPrice <= order.takeProfit) {
        tpStatus = "hit";
      } else {
        const distance =
          Math.abs(currentPrice - order.takeProfit) / order.takeProfit;
        tpStatus = distance < 0.02 ? "close" : "active";
      }
    }

    if (order.stopLoss) {
      if (order.type === "buy" && currentPrice <= order.stopLoss) {
        slStatus = "hit";
      } else if (order.type === "sell" && currentPrice >= order.stopLoss) {
        slStatus = "hit";
      } else {
        const distance =
          Math.abs(currentPrice - order.stopLoss) / order.stopLoss;
        slStatus = distance < 0.02 ? "close" : "active";
      }
    }

    return { tpStatus, slStatus };
  };

  const closePosition = async (orderId: string) => {
    try {
      setIsClosingPosition(orderId);
      const token = localStorage.getItem("token") || "";

      await closetrade(token, orderId);

      fetchOpenOrders();
      fetchClosedOrders();
    } catch (error) {
      console.error("Error closing position:", error);
    } finally {
      setIsClosingPosition(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-surface text-ink">
      {/* Header: what this panel is, and whether it's live. The tab bar below
          used to carry both jobs and did neither one clearly. */}
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="label">Positions</h2>
        <span className="flex items-center gap-1.5 text-[10px] text-ink-faint">
          <span className="h-1.5 w-1.5 rounded-full bg-long" />
          live
        </span>
      </div>

      <div className="flex border-b border-line">
        <button
          className={`flex-1 py-2.5 text-center text-[13px] font-medium transition-colors ${
            activeTab === "open"
              ? "text-accent shadow-[inset_0_-2px_0_0_var(--color-accent)]"
              : "text-ink-faint hover:text-ink-dim"
          }`}
          onClick={() => setActiveTab("open")}
        >
          Open Positions
          {openOrders.length > 0 && (
            <span className="num ml-1.5 text-[11px] text-ink-faint">
              {openOrders.length}
            </span>
          )}
        </button>
        <button
          className={`flex-1 py-2.5 text-center text-[13px] font-medium transition-colors ${
            activeTab === "closed"
              ? "text-accent shadow-[inset_0_-2px_0_0_var(--color-accent)]"
              : "text-ink-faint hover:text-ink-dim"
          }`}
          onClick={() => setActiveTab("closed")}
        >
          Order History
        </button>
      </div>

      {/* Compact metrics: committed margin and running P&L, without scanning
          every row for it. Only meaningful while there's something open. */}
      {activeTab === "open" && openOrders.length > 0 && (
        <div className="num flex items-center gap-5 border-b border-line bg-raised/40 px-4 py-2 text-[11px]">
          <span className="flex items-baseline gap-1.5">
            <span className="text-ink-faint">Committed</span>
            <span className="font-medium text-ink">${money(openSummary.margin)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-ink-faint">Unreal. P&amp;L</span>
            <span
              className={`font-medium ${openSummary.pnl >= 0 ? "text-long" : "text-short"}`}
            >
              {openSummary.pnl >= 0 ? "+" : ""}
              ${money(openSummary.pnl)}
            </span>
          </span>
        </div>
      )}

      <div className="p-4 overflow-auto flex-1">
        {isLoading ? (
          <div className="space-y-2 p-1" aria-label="Loading positions">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-9 animate-pulse rounded-[3px] bg-raised"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : activeTab === "open" ? (
          <>
            {openWithPnl.length > 0 ? (
              <div className="overflow-x-auto h-full">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-surface">
                    <tr className="label border-b border-line">
                      <th className="py-3 px-3 text-left font-medium">Symbol</th>
                      <th className="py-3 px-3 text-left font-medium">Status</th>
                      <th className="py-3 px-3 text-right font-medium">Type</th>
                      <th className="py-3 px-3 text-right font-medium">Margin</th>
                      <th className="py-3 px-3 text-right font-medium">Leverage</th>
                      <th className="py-3 px-3 text-right font-medium">Open Price</th>
                      <th className="py-3 px-3 text-right font-medium">Take Profit</th>
                      <th className="py-3 px-3 text-right font-medium">Stop Loss</th>
                      <th className="py-3 px-3 text-right font-medium">Liquidation</th>
                      <th className="py-3 px-3 text-right font-medium">Unreal. P&L</th>
                      <th className="py-3 px-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openWithPnl.map((order) => {
                      const { tpStatus, slStatus } = getTpSlStatus(order);
                      const sym = (order.asset || "BTC").replace("USDT", "");
                      const p = latestPrices[sym as keyof LivePrices];
                      const currentPrice = p
                        ? order.type === "buy"
                          ? p.bid
                          : p.ask
                        : 0;
                      const liquidationDistance = order.liquidationPrice
                        ? Math.abs(currentPrice - order.liquidationPrice) /
                          order.liquidationPrice
                        : 1;

                      let rowStatus: RowStatus = "normal";
                      if (tpStatus === "hit" || slStatus === "hit") {
                        rowStatus = "executed";
                      } else if (
                        tpStatus === "close" ||
                        slStatus === "close" ||
                        liquidationDistance < 0.05
                      ) {
                        rowStatus = "warning";
                      }

                      return (
                        <tr
                          key={order.orderId}
                          className={`border-b border-line/60 hover:bg-raised/50 ${
                            rowStatus === "executed"
                              ? "bg-green-500/5"
                              : rowStatus === "warning"
                              ? "bg-yellow-500/5"
                              : ""
                          }`}
                        >
                          <td className="py-3 px-3 font-medium text-ink">
                            {order.asset || "BTC"}
                            <span className="text-ink-faint text-xs">/USDT</span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={rowStatus} />
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-medium ${
                              order.type === "buy"
                                ? "text-[#158BF9]"
                                : "text-[#EB483F]"
                            }`}
                          >
                            {order.type === "buy" ? "LONG" : "SHORT"}
                          </td>
                          <td className="py-3 px-3 text-right text-ink">
                            {money(order.margin)} USD
                          </td>
                          <td className="py-3 px-3 text-right text-ink">
                            x{order.leverage}
                          </td>
                          <td className="py-3 px-3 text-right text-ink">
                            ${toDisplayPrice(order.openPrice)}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.takeProfit ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-green-400 font-medium">
                                  ${toDisplayPrice(order.takeProfit)}
                                </span>
                                {(() => {
                                  const { tpStatus } = getTpSlStatus(order);
                                  if (tpStatus === "hit") {
                                    return (
                                      <span className="text-green-500 text-xs">
                                        ✓
                                      </span>
                                    );
                                  } else if (tpStatus === "close") {
                                    return (
                                      <span className="text-yellow-500 text-xs animate-pulse">
                                        !
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-ink-faint text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.stopLoss ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-red-400 font-medium">
                                  ${toDisplayPrice(order.stopLoss)}
                                </span>
                                {(() => {
                                  const { slStatus } = getTpSlStatus(order);
                                  if (slStatus === "hit") {
                                    return (
                                      <span className="text-red-500 text-xs">
                                        ✓
                                      </span>
                                    );
                                  } else if (slStatus === "close") {
                                    return (
                                      <span className="text-yellow-500 text-xs animate-pulse">
                                        !
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-ink-faint text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {order.liquidationPrice ? (
                              <div className="flex items-center justify-end gap-2">
                                <span className="text-orange-400 font-medium">
                                  ${toDisplayPrice(order.liquidationPrice)}
                                </span>
                                {(() => {
                                  const sym = (order.asset || "BTC").replace(
                                    "USDT",
                                    ""
                                  );
                                  const p =
                                    latestPrices[sym as keyof LivePrices];
                                  if (!p) return null;
                                  const currentPrice =
                                    order.type === "buy" ? p.bid : p.ask;
                                  const distance =
                                    Math.abs(
                                      currentPrice - order.liquidationPrice
                                    ) / order.liquidationPrice;
                                  if (distance < 0.05) {
                                    return (
                                      <span className="text-red-500 text-xs animate-pulse">
                                        ⚠
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-ink-faint text-xs">—</span>
                            )}
                          </td>
                          <td
                            className={`py-3 px-3 text-right font-medium ${
                              order.pnlUsd >= 0
                                ? "text-green-500"
                                : "text-[#EB483F]"
                            }`}
                          >
                            {order.pnlUsd >= 0 ? "+" : ""}
                            {money(order.pnlUsd)} USD
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => closePosition(order.orderId)}
                              disabled={isClosingPosition === order.orderId}
                              className="btn border border-short/40 bg-short/10 px-3 py-1.5 text-[12px] text-short hover:border-short hover:bg-short hover:text-[#1a0605] disabled:hover:bg-short/10 disabled:hover:text-short"
                            >
                              {isClosingPosition === order.orderId
                                ? "Closing…"
                                : "Close"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              /* A composed empty state: say what belongs here and how it gets
                 here. Bare "No open positions" wastes the panel. */
              <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                <div className="flex items-end gap-1" aria-hidden>
                  <span className="h-3 w-1.5 bg-long/30" />
                  <span className="h-5 w-1.5 bg-short/30" />
                  <span className="h-4 w-1.5 bg-long/30" />
                  <span className="h-7 w-1.5 bg-line" />
                </div>
                <p className="mt-4 text-[13px] font-medium text-ink-dim">
                  No open positions
                </p>
                <p className="mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-ink-faint">
                  Set a margin and leverage in the ticket, then long or short.
                  Your liquidation price is shown before you confirm.
                </p>
              </div>
            )}
          </>
        ) : closedOrders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="label border-b border-line">
                  <th className="py-3 px-3 text-left font-medium">Symbol</th>
                  <th className="py-3 px-3 text-right font-medium">Type</th>
                  <th className="py-3 px-3 text-right font-medium">Margin</th>
                  <th className="py-3 px-3 text-right font-medium">Open Price</th>
                  <th className="py-3 px-3 text-right font-medium">Close Price</th>
                  <th className="py-3 px-3 text-right font-medium">P&L</th>
                </tr>
              </thead>
              <tbody>
                {closedOrders.map((order) => (
                  <tr
                    key={order.orderId}
                    className="border-b border-line/60 hover:bg-raised/50"
                  >
                    <td className="py-3 px-3 font-medium text-ink">
                      {order.asset || "BTC"}
                      <span className="text-ink-faint text-xs">/USDT</span>
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        order.type === "buy"
                          ? "text-[#158BF9]"
                          : "text-[#EB483F]"
                      }`}
                    >
                      {order.type === "buy" ? "LONG" : "SHORT"}
                    </td>
                    <td className="py-3 px-3 text-right text-ink">
                      {money(order.margin)} USD
                    </td>
                    <td className="py-3 px-3 text-right text-ink">
                      ${toDisplayPrice(order.openPrice)}
                    </td>
                    <td className="py-3 px-3 text-right text-ink">
                      ${toDisplayPrice(order.closePrice)}
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-medium ${
                        toDisplayPriceUSD(order.pnl) >= 0
                          ? "text-green-500"
                          : "text-[#EB483F]"
                      }`}
                    >
                      {order.pnl >= 0 ? "+" : ""}
                      {money(order.pnl)} USD
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="text-[13px] font-medium text-ink-dim">No closed positions</p>
            <p className="mx-auto mt-1.5 max-w-[34ch] text-[12px] leading-relaxed text-ink-faint">
              Closed positions land here with their entry, exit and realised P&L.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
