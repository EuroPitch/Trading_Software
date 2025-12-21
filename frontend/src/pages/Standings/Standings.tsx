import React, { useState, useEffect } from "react";
import "./Standings.css";
import { supabase } from "../../supabaseClient";

type Standing = {
  rank: number;
  displayName: string;
  portfolioValue: number;
  totalReturn: number;
  returnPercent: number;
  winRate: number;
  totalTrades: number;
  bestTrade: number;
  lastActive: string;
  joinDate?: string;
  // internal id kept for matching/highlighting but must NOT be rendered
  id?: number | string;
};

export default function Standings() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [timeframe, setTimeframe] = useState<string>("all-time");
  const [loading, setLoading] = useState<boolean>(true);
  const currentUserId: number | null = 3; // This would come from your auth context later

  // Fetch live standings from Supabase `profiles` table and rank by `realized_pnl`.
  useEffect(() => {
    let cancelled = false;

    const fetchStandings = async () => {
      setLoading(true);
      try {
        let rows: any[] | null = null;

        // Preferred: server-side ordering by realized_pnl (descending)
        try {
          const { data, error } = await supabase
            .from("profiles")
            .select(
              "society_name, equity_value, realized_pnl, return_percent, win_rate, total_trades, best_trade, last_active, join_date"
            )
            .order("realized_pnl", { ascending: false });

          if (!error && data) {
            rows = data as any[];
          } else if (error) {
            console.warn(
              "Supabase ordered query error - falling back to client-side sort:",
              error.message ?? error
            );
          }
        } catch (err) {
          console.warn("Supabase ordered query threw; falling back:", err);
        }

        // Fallback: select all and sort locally
        if (!rows) {
          const { data, error } = await supabase.from("profiles").select("*");
          if (error)
            console.error(
              "Supabase select('*') error:",
              error.message ?? error
            );
          rows = data as any[] | null;
        }

        if (cancelled) return;

        if (!rows || rows.length === 0) {
          setStandings([]);
          setLoading(false);
          return;
        }

        // Sort by realized_pnl (use common fallbacks if naming differs)
        const sorted = [...rows].sort((a: any, b: any) => {
          const aPnl = Number(
            a.realized_pnl ?? a.realizedPnl ?? a.total_pnl ?? a.totalPnl ?? 0
          );
          const bPnl = Number(
            b.realized_pnl ?? b.realizedPnl ?? b.total_pnl ?? b.totalPnl ?? 0
          );
          return bPnl - aPnl;
        });

        const mapped: Standing[] = sorted.map((r: any, idx: number) => ({
          // keep internal id for matching/highlighting but do NOT render it
          id: r.id ?? idx + 1,
          rank: idx + 1,
          // Only use society_name for UI display names per requirement
          displayName: r.society_name ?? `Society ${idx + 1}`,
          portfolioValue: Number(
            r.equity_value ??
              r.equityValue ??
              r.portfolio_value ??
              r.portfolioValue ??
              0
          ),
          totalReturn: Number(
            r.realized_pnl ?? r.realizedPnl ?? r.total_pnl ?? r.totalPnl ?? 0
          ),
          returnPercent: Number(r.return_percent ?? r.returnPercent ?? 0),
          winRate: Number(r.win_rate ?? r.winRate ?? 0),
          totalTrades: Number(r.total_trades ?? r.totalTrades ?? 0),
          bestTrade: Number(r.best_trade ?? r.bestTrade ?? 0),
          lastActive:
            r.last_active ??
            r.lastActive ??
            r.updated_at ??
            r.created_at ??
            new Date().toISOString(),
          joinDate: r.join_date ?? r.joinDate ?? undefined,
        }));

        setStandings(mapped);
        setLoading(false);
      } catch (err) {
        console.error("Unexpected error fetching standings:", err);
        if (!cancelled) {
          setStandings([]);
          setLoading(false);
        }
      }
    };

    fetchStandings();

    return () => {
      cancelled = true;
    };
  }, [timeframe]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "rank-badge gold";
    if (rank === 2) return "rank-badge silver";
    if (rank === 3) return "rank-badge bronze";
    return "rank-badge";
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return rank;
  };

  if (loading) {
    return (
      <div className="standings-container">
        <div className="loading-spinner">Loading standings...</div>
      </div>
    );
  }

  const currentUser = standings.find((s) => s.id === currentUserId) || null;
  const topPerformers = standings.slice(0, 3);

  // Render the podium so 1st place appears centered visually: order [2nd, 1st, 3rd]
  const podiumOrder = (() => {
    if (topPerformers.length >= 3)
      return [topPerformers[1], topPerformers[0], topPerformers[2]];
    if (topPerformers.length === 2) return [topPerformers[1], topPerformers[0]];
    return topPerformers;
  })();

  return (
    <div className="standings-container">
      <div className="standings-header">
        <div className="header-content">
          <h1>Society Standings</h1>
          <p className="header-subtitle">
            Track your society's performance against other societies
          </p>
        </div>

        <div className="timeframe-selector">
          <button
            className={
              timeframe === "daily" ? "timeframe-btn active" : "timeframe-btn"
            }
            onClick={() => setTimeframe("daily")}
          >
            Daily
          </button>
          <button
            className={
              timeframe === "weekly" ? "timeframe-btn active" : "timeframe-btn"
            }
            onClick={() => setTimeframe("weekly")}
          >
            Weekly
          </button>
          <button
            className={
              timeframe === "monthly" ? "timeframe-btn active" : "timeframe-btn"
            }
            onClick={() => setTimeframe("monthly")}
          >
            Monthly
          </button>
          <button
            className={
              timeframe === "all-time"
                ? "timeframe-btn active"
                : "timeframe-btn"
            }
            onClick={() => setTimeframe("all-time")}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="podium-section">
        <h2>Top Societies</h2>
        <div className="podium-cards">
          {podiumOrder.map((trader: Standing | undefined, idx: number) => {
            if (!trader) return null;
            return (
              <div
                key={`${trader.displayName}-${trader.rank}`}
                className={`podium-card rank-${trader.rank} ${
                  trader.id === currentUserId ? "current-user" : ""
                } ${idx === 1 ? "podium-center" : ""}`}
              >
                <div className="podium-rank">{getRankIcon(trader.rank)}</div>
                <div className="podium-user">
                  <div className="podium-avatar">
                    {(trader.displayName || "?").charAt(0).toUpperCase()}
                  </div>
                  <h3>{trader.displayName}</h3>
                  {/* username intentionally omitted; show only society name */}
                </div>
                <div className="podium-stats">
                  <div className="podium-stat">
                    <span className="stat-label">Funds</span>
                    <span className="stat-value">
                      {formatCurrency(trader.portfolioValue)}
                    </span>
                  </div>
                  <div className="podium-stat">
                    <span className="stat-label">Total Return</span>
                    <span
                      className={`stat-value ${
                        trader.totalReturn >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {formatCurrency(trader.totalReturn)}
                    </span>
                  </div>
                  <div className="podium-stat highlight">
                    <span className="stat-label">Return %</span>
                    <span
                      className={`stat-value-large ${
                        trader.returnPercent >= 0 ? "positive" : "negative"
                      }`}
                    >
                      {formatPercent(trader.returnPercent)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full Standings Table */}
      <div className="standings-table-section">
        <h2>Full Leaderboard</h2>
        <div className="table-wrapper">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Society</th>
                <th className="align-right">Funds</th>
                <th className="align-right">Total Return</th>
                <th className="align-right">Return %</th>
                <th className="align-right">Win Rate</th>
                <th className="align-right">Total Trades</th>
                <th className="align-right">Best Trade</th>
                <th className="align-right">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((trader: any) => (
                <tr
                  key={`${trader.displayName}-${trader.rank}`}
                  className={`standings-row ${
                    trader.id === currentUserId ? "current-user-row" : ""
                  }`}
                >
                  <td>
                    <span className={getRankBadgeClass(trader.rank)}>
                      {getRankIcon(trader.rank)}
                    </span>
                  </td>
                  <td>
                    <div className="trader-cell">
                      <div className="trader-avatar">
                        {(trader.displayName || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="trader-info">
                        <strong>{trader.displayName}</strong>
                        {/* username intentionally omitted; only show society name */}
                      </div>
                      {trader.id === currentUserId && (
                        <span className="you-badge">Your Society</span>
                      )}
                    </div>
                  </td>
                  <td className="align-right">
                    {formatCurrency(trader.portfolioValue)}
                  </td>
                  <td
                    className={`align-right ${
                      trader.totalReturn >= 0 ? "positive" : "negative"
                    }`}
                  >
                    {formatCurrency(trader.totalReturn)}
                  </td>
                  <td
                    className={`align-right ${
                      trader.returnPercent >= 0 ? "positive" : "negative"
                    }`}
                  >
                    <strong>{formatPercent(trader.returnPercent)}</strong>
                  </td>
                  <td className="align-right">
                    {(trader.winRate ?? 0).toFixed(1)}%
                  </td>
                  <td className="align-right">{trader.totalTrades}</td>
                  <td className="align-right positive">
                    {formatCurrency(trader.bestTrade)}
                  </td>
                  <td className="align-right time-cell">
                    {formatDate(trader.lastActive)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="stats-footer">
        <div className="footer-stat">
          <span className="footer-label">Total Participants</span>
          <span className="footer-value">{standings.length}</span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Avg Portfolio Value</span>
          <span className="footer-value">
            {standings.length > 0
              ? formatCurrency(
                  standings.reduce((sum, s) => sum + s.portfolioValue, 0) /
                    standings.length
                )
              : "—"}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Avg Return</span>
          <span className="footer-value positive">
            {standings.length > 0
              ? formatPercent(
                  standings.reduce((sum, s) => sum + s.returnPercent, 0) /
                    standings.length
                )
              : "—"}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Competition Started</span>
          <span className="footer-value">Jan 10, 2025</span>
        </div>
      </div>
    </div>
  );
}
