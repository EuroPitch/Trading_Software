import React, { useState, useEffect } from 'react';
import './Standings.css';

export default function Standings() {
  const [standings, setStandings] = useState([]);
  const [timeframe, setTimeframe] = useState('all-time');
  const [loading, setLoading] = useState(true);
  const currentUserId = 3; // This would come from your auth context later

  // Mock data - replace with Supabase query later
  useEffect(() => {
    setTimeout(() => {
      const mockStandings = [
        {
          id: 1,
          rank: 1,
          username: 'ASTRA',
          displayName: 'Astra Investment Collective',
          portfolioValue: 1245680.50,
          totalReturn: 245680.50,
          returnPercent: 24.57,
          winRate: 68.5,
          totalTrades: 147,
          bestTrade: 45230.00,
          lastActive: '2025-11-23T14:30:00',
          joinDate: '2025-01-15'
        },
        // ... other mock entries omitted for brevity (kept in original file)
      ];

      setStandings(mockStandings);
      setLoading(false);
    }, 500);
  }, [timeframe]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
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
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return rank;
  };

  if (loading) {
    return (
      <div className="standings-container">
        <div className="loading-spinner">Loading standings...</div>
      </div>
    );
  }

  const currentUser = standings.find((s: any) => s.id === currentUserId);
  const topPerformers = standings.slice(0, 3);

  return (
    <div className="standings-container">
      <div className="standings-header">
        <div className="header-content">
          <h1>Society Standings</h1>
          <p className="header-subtitle">Track your society's performance against other societies</p>
        </div>
        
        <div className="timeframe-selector">
          <button 
            className={timeframe === 'daily' ? 'timeframe-btn active' : 'timeframe-btn'}
            onClick={() => setTimeframe('daily')}
          >
            Daily
          </button>
          <button 
            className={timeframe === 'weekly' ? 'timeframe-btn active' : 'timeframe-btn'}
            onClick={() => setTimeframe('weekly')}
          >
            Weekly
          </button>
          <button 
            className={timeframe === 'monthly' ? 'timeframe-btn active' : 'timeframe-btn'}
            onClick={() => setTimeframe('monthly')}
          >
            Monthly
          </button>
          <button 
            className={timeframe === 'all-time' ? 'timeframe-btn active' : 'timeframe-btn'}
            onClick={() => setTimeframe('all-time')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="podium-section">
        <h2>Top Societies</h2>
        <div className="podium-cards">
          {topPerformers.map((trader: any) => (
            <div 
              key={trader.id} 
              className={`podium-card rank-${trader.rank} ${trader.id === currentUserId ? 'current-user' : ''}`}
            >
              <div className="podium-rank">{getRankIcon(trader.rank)}</div>
              <div className="podium-user">
                <div className="podium-avatar">{trader.username.charAt(0).toUpperCase()}</div>
                <h3>{trader.displayName}</h3>
                <p className="podium-username">@{trader.username}</p>
              </div>
              <div className="podium-stats">
                <div className="podium-stat">
                  <span className="stat-label">Funds</span>
                  <span className="stat-value">{formatCurrency(trader.portfolioValue)}</span>
                </div>
                <div className="podium-stat">
                  <span className="stat-label">Total Return</span>
                  <span className={`stat-value ${trader.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(trader.totalReturn)}
                  </span>
                </div>
                <div className="podium-stat highlight">
                  <span className="stat-label">Return %</span>
                  <span className={`stat-value-large ${trader.returnPercent >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(trader.returnPercent)}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
                  className={`standings-row ${trader.id === currentUserId ? 'current-user-row' : ''}`}
                >
                  <td>
                    <span className={getRankBadgeClass(trader.rank)}>
                      {getRankIcon(trader.rank)}
                    </span>
                  </td>
                  <td>
                    <div className="trader-cell">
                      <div className="trader-avatar">{trader.username.charAt(0).toUpperCase()}</div>
                      <div className="trader-info">
                        <strong>{trader.displayName}</strong>
                        <span className="trader-username">@{trader.username}</span>
                      </div>
                      {trader.id === currentUserId && (
                        <span className="you-badge">Your Society</span>
                      )}
                    </div>
                  </td>
                  <td className="align-right">{formatCurrency(trader.portfolioValue)}</td>
                  <td className={`align-right ${trader.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(trader.totalReturn)}
                  </td>
                  <td className={`align-right ${trader.returnPercent >= 0 ? 'positive' : 'negative'}`}>
                    <strong>{formatPercent(trader.returnPercent)}</strong>
                  </td>
                  <td className="align-right">{trader.winRate.toFixed(1)}%</td>
                  <td className="align-right">{trader.totalTrades}</td>
                  <td className="align-right positive">{formatCurrency(trader.bestTrade)}</td>
                  <td className="align-right time-cell">{formatDate(trader.lastActive)}</td>
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
            {formatCurrency(standings.reduce((sum: number, s: any) => sum + s.portfolioValue, 0) / standings.length)}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Avg Return</span>
          <span className="footer-value positive">
            {formatPercent(standings.reduce((sum: number, s: any) => sum + s.returnPercent, 0) / standings.length)}
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
