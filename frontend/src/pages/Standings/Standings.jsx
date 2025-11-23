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
          username: 'TradeMaster_Pro',
          displayName: 'Alex Morgan',
          portfolioValue: 1245680.50,
          totalReturn: 245680.50,
          returnPercent: 24.57,
          winRate: 68.5,
          totalTrades: 147,
          bestTrade: 45230.00,
          lastActive: '2025-11-23T14:30:00',
          joinDate: '2025-01-15'
        },
        {
          id: 2,
          rank: 2,
          username: 'QuantQueen',
          displayName: 'Sarah Chen',
          portfolioValue: 1198340.25,
          totalReturn: 198340.25,
          returnPercent: 19.83,
          winRate: 64.2,
          totalTrades: 203,
          bestTrade: 38950.00,
          lastActive: '2025-11-23T16:15:00',
          joinDate: '2025-01-20'
        },
        {
          id: 3,
          rank: 3,
          username: 'YourUsername',
          displayName: 'You',
          portfolioValue: 1156720.00,
          totalReturn: 156720.00,
          returnPercent: 15.67,
          winRate: 61.8,
          totalTrades: 128,
          bestTrade: 32100.00,
          lastActive: '2025-11-23T17:20:00',
          joinDate: '2025-02-01'
        },
        {
          id: 4,
          rank: 4,
          username: 'ValueInvestor',
          displayName: 'Michael Roberts',
          portfolioValue: 1134590.75,
          totalReturn: 134590.75,
          returnPercent: 13.46,
          winRate: 58.9,
          totalTrades: 89,
          bestTrade: 29800.00,
          lastActive: '2025-11-23T12:45:00',
          joinDate: '2025-01-10'
        },
        {
          id: 5,
          rank: 5,
          username: 'TechBull2025',
          displayName: 'James Wilson',
          portfolioValue: 1121450.50,
          totalReturn: 121450.50,
          returnPercent: 12.15,
          winRate: 56.3,
          totalTrades: 176,
          bestTrade: 27650.00,
          lastActive: '2025-11-23T15:30:00',
          joinDate: '2025-01-25'
        },
        {
          id: 6,
          rank: 6,
          username: 'DividendKing',
          displayName: 'Robert Taylor',
          portfolioValue: 1098230.00,
          totalReturn: 98230.00,
          returnPercent: 9.82,
          winRate: 54.1,
          totalTrades: 94,
          bestTrade: 24300.00,
          lastActive: '2025-11-23T11:20:00',
          joinDate: '2025-02-05'
        },
        {
          id: 7,
          rank: 7,
          username: 'MomentumTrader',
          displayName: 'Emily Davis',
          portfolioValue: 1087560.25,
          totalReturn: 87560.25,
          returnPercent: 8.76,
          winRate: 52.7,
          totalTrades: 215,
          bestTrade: 22100.00,
          lastActive: '2025-11-23T13:50:00',
          joinDate: '2025-01-30'
        },
        {
          id: 8,
          rank: 8,
          username: 'GrowthHunter',
          displayName: 'David Martinez',
          portfolioValue: 1072890.50,
          totalReturn: 72890.50,
          returnPercent: 7.29,
          winRate: 50.2,
          totalTrades: 142,
          bestTrade: 19850.00,
          lastActive: '2025-11-23T16:40:00',
          joinDate: '2025-02-10'
        },
        {
          id: 9,
          rank: 9,
          username: 'IndexFollower',
          displayName: 'Lisa Anderson',
          portfolioValue: 1065340.75,
          totalReturn: 65340.75,
          returnPercent: 6.53,
          winRate: 49.8,
          totalTrades: 67,
          bestTrade: 18200.00,
          lastActive: '2025-11-23T10:15:00',
          joinDate: '2025-02-15'
        },
        {
          id: 10,
          rank: 10,
          username: 'SwingTrader_X',
          displayName: 'Chris Thompson',
          portfolioValue: 1058920.00,
          totalReturn: 58920.00,
          returnPercent: 5.89,
          winRate: 48.5,
          totalTrades: 198,
          bestTrade: 16750.00,
          lastActive: '2025-11-23T14:05:00',
          joinDate: '2025-02-20'
        }
      ];

      setStandings(mockStandings);
      setLoading(false);
    }, 500);
  }, [timeframe]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getRankBadgeClass = (rank) => {
    if (rank === 1) return 'rank-badge gold';
    if (rank === 2) return 'rank-badge silver';
    if (rank === 3) return 'rank-badge bronze';
    return 'rank-badge';
  };

  const getRankIcon = (rank) => {
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

  const currentUser = standings.find(s => s.id === currentUserId);
  const topPerformers = standings.slice(0, 3);

  return (
    <div className="standings-container">
      <div className="standings-header">
        <div className="header-content">
          <h1>Competition Standings</h1>
          <p className="header-subtitle">Track your performance against other traders</p>
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
        <h2>Top Performers</h2>
        <div className="podium-cards">
          {topPerformers.map((trader) => (
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
                  <span className="stat-label">Portfolio Value</span>
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

      {/* Your Position Highlight */}
      {currentUser && currentUser.rank > 3 && (
        <div className="your-position-card">
          <div className="position-header">
            <h3>Your Current Position</h3>
            <span className="rank-badge">#{currentUser.rank}</span>
          </div>
          <div className="position-stats">
            <div className="position-stat">
              <span className="stat-label">Portfolio Value</span>
              <span className="stat-value">{formatCurrency(currentUser.portfolioValue)}</span>
            </div>
            <div className="position-stat">
              <span className="stat-label">Total Return</span>
              <span className={`stat-value ${currentUser.totalReturn >= 0 ? 'positive' : 'negative'}`}>
                {formatCurrency(currentUser.totalReturn)}
              </span>
            </div>
            <div className="position-stat">
              <span className="stat-label">Return %</span>
              <span className={`stat-value ${currentUser.returnPercent >= 0 ? 'positive' : 'negative'}`}>
                {formatPercent(currentUser.returnPercent)}
              </span>
            </div>
            <div className="position-stat">
              <span className="stat-label">Win Rate</span>
              <span className="stat-value">{currentUser.winRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Full Standings Table */}
      <div className="standings-table-section">
        <h2>Full Leaderboard</h2>
        <div className="table-wrapper">
          <table className="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Trader</th>
                <th className="align-right">Portfolio Value</th>
                <th className="align-right">Total Return</th>
                <th className="align-right">Return %</th>
                <th className="align-right">Win Rate</th>
                <th className="align-right">Total Trades</th>
                <th className="align-right">Best Trade</th>
                <th className="align-right">Last Active</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((trader) => (
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
                        <span className="you-badge">You</span>
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
            {formatCurrency(standings.reduce((sum, s) => sum + s.portfolioValue, 0) / standings.length)}
          </span>
        </div>
        <div className="footer-stat">
          <span className="footer-label">Avg Return</span>
          <span className="footer-value positive">
            {formatPercent(standings.reduce((sum, s) => sum + s.returnPercent, 0) / standings.length)}
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
