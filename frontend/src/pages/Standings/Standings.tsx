import React, { useState, useEffect } from "react";
import "./Standings.css";
import { supabase } from "../../supabaseClient";

type Standing = {
  id?: number | string; // internal only, not rendered explicitly
  rank: number;
  displayName: string;      // society_name
  portfolioValue: number;   // total_equity (Funds)
  totalReturn: number;      // realized_pnl (PnL)
  returnPercent: number;    // derived from totalReturn / portfolioValue
};

export default function Standings() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [timeframe, setTimeframe] = useState<string>("all-time");
  const [loading, setLoading] = useState<boolean>(true);
  const currentUserId: number | null = 3; // placeholder until auth wired

  useEffect(() => {
    let cancelled = false;

    const fetchStandings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, society_name, total_equity, realized_pnl");

        if (error) {
          console.warn("Supabase select(...) error:", error.message ?? error);
        }

        const rows = (data as any[]) || [];

        if (cancelled) return;

        if (!rows || rows.length === 0) {
          setStandings([]);
          setLoading(false);
          return;
        }

        // Sort by realized_pnl descending
        const sorted = [...rows].sort((a: any, b: any) => {
          const aPnl = Number(a.realized_pnl ?? 0);
          const bPnl = Number(b.realized_pnl ?? 0);
          return bPnl - aPnl;
        });

        const mapped: Standing[] = sorted.map((r: any, idx: number) => {
          const portfolioValue = Number(r.total_equity ?? 0);
          const totalReturn = Number(r.realized_pnl ?? 0);
          const returnPercent =
            portfolioValue > 0 ? (totalReturn / portfolioValue) * 100 : 0;

          return {
            id: r.id ?? idx + 1,
            rank: idx + 1,
            displayName: r.society_name ?? `Society ${idx + 1}`,
            portfolioValue,
            totalReturn,
            returnPercent,
          };
        });

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
            Track your society&apos;s performance against other societies
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
                {/* Keeping extra columns out since DB doesn’t provide them */}
              </tr>
            </thead>
            <tbody>
              {standings.map((trader: Standing) => (
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
          <span className="footer-label">Avg Return %</span>
          <span className="footer-value">
            {standings.length > 0
              ? formatPercent(
                  standings.reduce((sum, s) => sum + s.returnPercent, 0) /
                    standings.length
                )
              : "—"}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Competition To Start</span>
          <span className="footer-value">Feb 02, 2026</span>
        </div>
      </div>
    </div>
  );
}