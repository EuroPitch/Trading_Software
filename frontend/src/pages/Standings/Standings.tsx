import React, { useState, useEffect } from "react";
import "./Standings.css";

type Standing = {
  id: number;
  rank: number;
  username: string;
  displayName: string;
  portfolioValue: number;
  totalReturn: number;
  returnPercent: number;
  winRate: number;
  totalTrades: number;
  bestTrade: number;
  lastActive: string;
  joinDate?: string;
};

export default function Standings() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [timeframe, setTimeframe] = useState<string>("all-time");
  const [loading, setLoading] = useState<boolean>(true);
  const currentUserId: number | null = 3; // This would come from your auth context later

  // Mock data - replace with Supabase query later
  useEffect(() => {
    setTimeout(() => {
      const mockStandings: Standing[] = [
        {
          id: 1,
          rank: 1,
          username: "ASTRA",
          displayName: "Astra Investment Collective",
          portfolioValue: 1_245_680.5,
          totalReturn: 245680.5,
          returnPercent: 24.57,
          winRate: 68.5,
          totalTrades: 147,
          bestTrade: 45230.0,
          lastActive: "2025-12-16T14:30:00",
          joinDate: "2025-01-15",
        },
        {
          id: 2,
          rank: 2,
          username: "NOVA",
          displayName: "Nova Capital Society",
          portfolioValue: 1_120_340.0,
          totalReturn: 220340.0,
          returnPercent: 24.45,
          winRate: 66.2,
          totalTrades: 132,
          bestTrade: 40210.0,
          lastActive: "2025-12-15T11:20:00",
          joinDate: "2025-02-03",
        },
        {
          id: 3,
          rank: 3,
          username: "EURONOMICS",
          displayName: "Euronomics Club",
          portfolioValue: 980_500.75,
          totalReturn: 180500.75,
          returnPercent: 22.5,
          winRate: 64.1,
          totalTrades: 158,
          bestTrade: 37800.0,
          lastActive: "2025-12-14T09:10:00",
          joinDate: "2025-01-10",
        },
        {
          id: 4,
          rank: 4,
          username: "VANGUARDU",
          displayName: "Vanguard U",
          portfolioValue: 870_200.0,
          totalReturn: 152200.0,
          returnPercent: 21.2,
          winRate: 61.7,
          totalTrades: 120,
          bestTrade: 24000.0,
          lastActive: "2025-12-13T17:05:00",
          joinDate: "2025-03-01",
        },
        {
          id: 5,
          rank: 5,
          username: "ALPHA",
          displayName: "Alpha Traders Society",
          portfolioValue: 765_430.25,
          totalReturn: 120430.25,
          returnPercent: 18.6,
          winRate: 59.0,
          totalTrades: 98,
          bestTrade: 19850.0,
          lastActive: "2025-12-12T12:00:00",
          joinDate: "2025-02-20",
        },
        {
          id: 6,
          rank: 6,
          username: "DELTA",
          displayName: "Delta Investment Club",
          portfolioValue: 690_120.0,
          totalReturn: 90120.0,
          returnPercent: 15.0,
          winRate: 56.3,
          totalTrades: 110,
          bestTrade: 15500.0,
          lastActive: "2025-12-11T08:45:00",
          joinDate: "2025-01-22",
        },
        {
          id: 7,
          rank: 7,
          username: "BETA",
          displayName: "Beta Financials",
          portfolioValue: 612_300.0,
          totalReturn: 62300.0,
          returnPercent: 11.3,
          winRate: 54.0,
          totalTrades: 85,
          bestTrade: 9400.0,
          lastActive: "2025-12-10T20:15:00",
          joinDate: "2025-03-10",
        },
        {
          id: 8,
          rank: 8,
          username: "SIGMA",
          displayName: "Sigma Markets",
          portfolioValue: 540_000.0,
          totalReturn: 40000.0,
          returnPercent: 8.0,
          winRate: 51.5,
          totalTrades: 76,
          bestTrade: 7200.0,
          lastActive: "2025-12-09T13:25:00",
          joinDate: "2025-02-05",
        },
        {
          id: 9,
          rank: 9,
          username: "OMEGA",
          displayName: "Omega Capital",
          portfolioValue: 470_850.9,
          totalReturn: 30850.9,
          returnPercent: 7.0,
          winRate: 49.8,
          totalTrades: 60,
          bestTrade: 6200.0,
          lastActive: "2025-12-08T16:40:00",
          joinDate: "2025-01-30",
        },
        {
          id: 10,
          rank: 10,
          username: "ZEUS",
          displayName: "Zeus Investment Group",
          portfolioValue: 415_200.0,
          totalReturn: 15200.0,
          returnPercent: 3.8,
          winRate: 47.2,
          totalTrades: 42,
          bestTrade: 4800.0,
          lastActive: "2025-12-07T10:05:00",
          joinDate: "2025-03-22",
        },
        {
          id: 11,
          rank: 11,
          username: "NOVUS",
          displayName: "Novus Equity",
          portfolioValue: 362_100.5,
          totalReturn: -1200.5,
          returnPercent: -0.33,
          winRate: 44.0,
          totalTrades: 35,
          bestTrade: 3000.0,
          lastActive: "2025-12-06T09:00:00",
          joinDate: "2025-02-14",
        },
        {
          id: 12,
          rank: 12,
          username: "RELIC",
          displayName: "Relic Traders",
          portfolioValue: 298_750.0,
          totalReturn: -12450.0,
          returnPercent: -4.0,
          winRate: 40.1,
          totalTrades: 28,
          bestTrade: 2500.0,
          lastActive: "2025-12-05T18:30:00",
          joinDate: "2025-01-05",
        },
      ];

      setStandings(mockStandings);
      setLoading(false);
    }, 500);
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
                key={trader.id}
                className={`podium-card rank-${trader.rank} ${
                  trader.id === currentUserId ? "current-user" : ""
                } ${idx === 1 ? "podium-center" : ""}`}
              >
                <div className="podium-rank">{getRankIcon(trader.rank)}</div>
                <div className="podium-user">
                  <div className="podium-avatar">
                    {(trader.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <h3>{trader.displayName}</h3>
                  <p className="podium-username">@{trader.username}</p>
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
                  key={trader.id}
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
                        {(trader.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="trader-info">
                        <strong>{trader.displayName}</strong>
                        <span className="trader-username">
                          @{trader.username}
                        </span>
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
