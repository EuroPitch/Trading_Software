import React, { useState, useEffect } from "react";
import "./Portfolio.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

type Position = {
  id: number | string;
  symbol: string;
  name?: string;
  positionType?: string; // "LONG" | "SHORT"
  quantity: number;
  entryPrice?: number;
  currentPrice?: number;
  marketValue?: number;
  costBasis?: number;
};

export default function Portfolio() {
  const { session, loading: authLoading } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper calculations
  const calculatePnL = (position: Position) => {
    const marketValue =
      typeof position.marketValue === "number"
        ? position.marketValue
        : (position.currentPrice ?? 0) * (position.quantity ?? 0);

    const costBasis =
      typeof position.costBasis === "number"
        ? position.costBasis
        : (position.entryPrice ?? 0) * (position.quantity ?? 0);

    if ((position.positionType ?? "LONG").toUpperCase() === "LONG") {
      return marketValue - costBasis;
    } else {
      return costBasis - marketValue;
    }
  };

  const calculatePnLPercent = (position: Position) => {
    const pnl = calculatePnL(position);
    const costBasis =
      typeof position.costBasis === "number"
        ? position.costBasis
        : (position.entryPrice ?? 0) * (position.quantity ?? 0);
    if (costBasis === 0) return 0;
    return (pnl / costBasis) * 100;
  };

  const calculateSummary = (positions: Position[]) => {
    const totalValue = positions.reduce((sum, pos) => {
      const mv =
        typeof pos.marketValue === "number"
          ? pos.marketValue
          : (pos.currentPrice ?? 0) * (pos.quantity ?? 0);
      return sum + mv;
    }, 0);

    const totalPnL = positions.reduce((sum, pos) => sum + calculatePnL(pos), 0);

    const totalCost = positions.reduce((sum, pos) => {
      const cb =
        typeof pos.costBasis === "number"
          ? pos.costBasis
          : (pos.entryPrice ?? 0) * (pos.quantity ?? 0);
      return sum + cb;
    }, 0);

    const totalPnLPercent = totalCost === 0 ? 0 : (totalPnL / totalCost) * 100;

    setSummary({
      totalValue,
      totalPnL,
      totalPnLPercent,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-UK", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  // Fetch positions from Supabase for the logged-in user
  useEffect(() => {
    const fetchPositions = async () => {
      setLoading(true);
      setError(null);

      try {
        // The app stores trades in `public.trades`.
        // and columns that roughly match the keys used below. If your table/column names differ,
        // update the query accordingly.
        const userId = session?.user?.id;
        if (!userId) {
          setPositions([]);
          setSummary({ totalValue: 0, totalPnL: 0, totalPnLPercent: 0 });
          setLoading(false);
          return;
        }

        // Explicitly select from public.trades; supabase allows schema-qualified table names.
        const { data, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId);

        if (fetchError) {
          throw fetchError;
        }

        const rows: Position[] = (data ?? []).map((r: any) => ({
          id: r.id,
          // common symbol column
          symbol: r.symbol ?? r.ticker ?? r.asset_symbol ?? "",
          // name / company
          name: r.name ?? r.company_name ?? r.asset_name,
          // position or trade side: LONG/SHORT or BUY/SELL -> normalize to LONG/SHORT
          positionType: (
            r.position_type ??
            r.positionType ??
            r.side ??
            r.trade_type ??
            "LONG"
          )
            .toString()
            .toUpperCase()
            .replace("BUY", "LONG")
            .replace("SELL", "SHORT"),
          // quantity may be stored as qty/shares
          quantity: Number(r.quantity ?? r.qty ?? r.shares ?? 0),
          // entry price / avg cost
          entryPrice: Number(
            r.entry_price ?? r.entryPrice ?? r.avg_cost ?? r.price ?? 0
          ),
          // current / last price
          currentPrice: Number(
            r.current_price ??
              r.currentPrice ??
              r.last_price ??
              r.price_now ??
              0
          ),
          marketValue: r.market_value ?? r.marketValue,
          costBasis: r.cost_basis ?? r.costBasis,
        }));

        setPositions(rows);

        // Compute summary locally first
        const computedTotalValue = rows.reduce((sum, pos) => {
          const mv =
            typeof pos.marketValue === "number"
              ? pos.marketValue
              : (pos.currentPrice ?? 0) * (pos.quantity ?? 0);
          return sum + mv;
        }, 0);

        const computedTotalPnL = rows.reduce(
          (sum, pos) => sum + calculatePnL(pos),
          0
        );

        const computedTotalCost = rows.reduce((sum, pos) => {
          const cb =
            typeof pos.costBasis === "number"
              ? pos.costBasis
              : (pos.entryPrice ?? 0) * (pos.quantity ?? 0);
          return sum + cb;
        }, 0);

        const computedTotalPnLPercent =
          computedTotalCost === 0
            ? 0
            : (computedTotalPnL / computedTotalCost) * 100;

        // Try to fetch precomputed totals from profiles table and prefer them when present
        try {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .limit(1)
            .maybeSingle();

          if (!profileError && profileData) {
            // Accept several common field names as fallbacks
            // Prefer `total_equity` for total value when available
            const pvRaw =
              profileData.total_equity ??
              profileData.total_value ??
              profileData.portfolio_value ??
              profileData.total_value_eur ??
              profileData.total_value_usd ??
              profileData.value;
            const pnlRaw =
              profileData.total_pnl ??
              profileData.pnl ??
              profileData.unrealized_pnl ??
              profileData.realized_pnl ??
              profileData.profit_loss;
            const retRaw =
              profileData.total_return ??
              profileData.total_return_percent ??
              profileData.return_percent ??
              profileData.returns;

            const pv = typeof pvRaw === "number" ? pvRaw : Number(pvRaw ?? NaN);
            const ppnl =
              typeof pnlRaw === "number" ? pnlRaw : Number(pnlRaw ?? NaN);
            const pret =
              typeof retRaw === "number" ? retRaw : Number(retRaw ?? NaN);

            // Determine an initial capital value (prefer explicit field if present)
            const initialCapitalRaw =
              profileData.initial_capital ??
              profileData.starting_balance ??
              profileData.initial_balance ??
              profileData.initial_deposit ??
              100000;
            const initialCapital = Number.isFinite(Number(initialCapitalRaw))
              ? Number(initialCapitalRaw)
              : 100000;

            // Choose total value: prefer pv (profile-derived) when finite, otherwise computedTotalValue
            const totalValueChosen =
              Number.isFinite(pv) && pv !== 0 ? pv : computedTotalValue;

            // If total_equity is present on the profile (we used it for pvRaw), compute PnL persistently as equity - initialCapital
            if (profileData.total_equity !== undefined) {
              const persistentPnL = totalValueChosen - initialCapital;
              const persistentPnLPercent =
                initialCapital === 0
                  ? 0
                  : (persistentPnL / initialCapital) * 100;

              setSummary({
                totalValue: totalValueChosen,
                totalPnL: persistentPnL,
                totalPnLPercent: persistentPnLPercent,
              });
            } else {
              // Fall back to any profile-stored PnL/Return, otherwise computed values
              setSummary({
                totalValue: totalValueChosen,
                totalPnL: Number.isFinite(ppnl) ? ppnl : computedTotalPnL,
                totalPnLPercent: Number.isFinite(pret)
                  ? pret
                  : computedTotalPnLPercent,
              });
            }
          } else {
            // No profile totals available — use computed values
            setSummary({
              totalValue: computedTotalValue,
              totalPnL: computedTotalPnL,
              totalPnLPercent: computedTotalPnLPercent,
            });
          }
        } catch (profileFetchErr) {
          // On any profile fetch error, fall back to computed values
          console.warn("Error fetching profile totals:", profileFetchErr);
          setSummary({
            totalValue: computedTotalValue,
            totalPnL: computedTotalPnL,
            totalPnLPercent: computedTotalPnLPercent,
          });
        }
      } catch (err: any) {
        console.error("Error fetching positions:", err?.message ?? err);
        setError(err?.message ?? "An error occurred while fetching positions");
      } finally {
        setLoading(false);
      }
    };

    // fetch when auth state ready or changes
    if (!authLoading) fetchPositions();
  }, [session, authLoading]);

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h1>Portfolio Positions</h1>
        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">
              {formatCurrency(summary.totalValue)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total P&L</span>
            <span
              className={`summary-value ${
                summary.totalPnL >= 0 ? "positive" : "negative"
              }`}
            >
              {formatCurrency(summary.totalPnL)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Return</span>
            <span
              className={`summary-value ${
                summary.totalPnLPercent >= 0 ? "positive" : "negative"
              }`}
            >
              {formatPercent(summary.totalPnLPercent)}
            </span>
          </div>
        </div>
      </div>

      <div className="positions-table-container">
        {loading ? (
          <div className="loading">Loading positions…</div>
        ) : error ? (
          <div className="error">{error}</div>
        ) : (
          <>
            <table className="positions-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Position</th>
                  <th className="align-right">Quantity</th>
                  <th className="align-right">Entry Price</th>
                  <th className="align-right">Current Price</th>
                  <th className="align-right">Market Value</th>
                  <th className="align-right">P&L ($)</th>
                  <th className="align-right">P&L (%)</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((position) => {
                  const pnl = calculatePnL(position);
                  const pnlPercent = calculatePnLPercent(position);

                  return (
                    <tr key={position.id} className="position-row">
                      <td className="symbol-cell">
                        <strong>{position.symbol}</strong>
                      </td>
                      <td className="name-cell">{position.name}</td>
                      <td>
                        <span
                          className={`position-badge ${(
                            position.positionType ?? ""
                          ).toLowerCase()}`}
                        >
                          {position.positionType}
                        </span>
                      </td>
                      <td className="align-right">{position.quantity}</td>
                      <td className="align-right">
                        {formatCurrency(position.entryPrice ?? 0)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(position.currentPrice ?? 0)}
                      </td>
                      <td className="align-right">
                        {formatCurrency(
                          position.marketValue ??
                            (position.currentPrice ?? 0) *
                              (position.quantity ?? 0)
                        )}
                      </td>
                      <td
                        className={`align-right ${
                          pnl >= 0 ? "positive" : "negative"
                        }`}
                      >
                        {formatCurrency(pnl)}
                      </td>
                      <td
                        className={`align-right ${
                          pnlPercent >= 0 ? "positive" : "negative"
                        }`}
                      >
                        {formatPercent(pnlPercent)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {positions.length === 0 && (
              <div className="empty-state">
                <p>
                  No positions found. Start trading to see your portfolio here.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
