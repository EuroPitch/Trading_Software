import React, { useState, useEffect } from 'react';
import './Portfolio.css';

export default function Portfolio() {
  const [positions, setPositions] = useState([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0
  });

  // Mock data - replace with your API call
  useEffect(() => {
    const mockPositions = [
      {
        id: 1,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        positionType: 'LONG',
        quantity: 100,
        entryPrice: 150.00,
        currentPrice: 165.50,
        marketValue: 16550.00,
        costBasis: 15000.00
      },
      {
        id: 2,
        symbol: 'TSLA',
        name: 'Tesla Inc.',
        positionType: 'SHORT',
        quantity: 50,
        entryPrice: 250.00,
        currentPrice: 235.00,
        marketValue: 11750.00,
        costBasis: 12500.00
      },
      {
        id: 3,
        symbol: 'MSFT',
        name: 'Microsoft Corporation',
        positionType: 'LONG',
        quantity: 75,
        entryPrice: 300.00,
        currentPrice: 285.00,
        marketValue: 21375.00,
        costBasis: 22500.00
      }
    ];

    setPositions(mockPositions);
    calculateSummary(mockPositions);
  }, []);

  const calculatePnL = (position) => {
    if (position.positionType === 'LONG') {
      return position.marketValue - position.costBasis;
    } else {
      return position.costBasis - position.marketValue;
    }
  };

  const calculatePnLPercent = (position) => {
    const pnl = calculatePnL(position);
    return (pnl / position.costBasis) * 100;
  };

  const calculateSummary = (positions) => {
    const totalValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0);
    const totalPnL = positions.reduce((sum, pos) => sum + calculatePnL(pos), 0);
    const totalCost = positions.reduce((sum, pos) => sum + pos.costBasis, 0);
    const totalPnLPercent = (totalPnL / totalCost) * 100;

    setSummary({
      totalValue,
      totalPnL,
      totalPnLPercent
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const formatPercent = (value) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="portfolio-container">
      <div className="portfolio-header">
        <h1>Portfolio Positions</h1>
        <div className="portfolio-summary">
          <div className="summary-card">
            <span className="summary-label">Total Value</span>
            <span className="summary-value">{formatCurrency(summary.totalValue)}</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total P&L</span>
            <span className={`summary-value ${summary.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {formatCurrency(summary.totalPnL)}
            </span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Total Return</span>
            <span className={`summary-value ${summary.totalPnLPercent >= 0 ? 'positive' : 'negative'}`}>
              {formatPercent(summary.totalPnLPercent)}
            </span>
          </div>
        </div>
      </div>

      <div className="positions-table-container">
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
                    <span className={`position-badge ${position.positionType.toLowerCase()}`}>
                      {position.positionType}
                    </span>
                  </td>
                  <td className="align-right">{position.quantity}</td>
                  <td className="align-right">{formatCurrency(position.entryPrice)}</td>
                  <td className="align-right">{formatCurrency(position.currentPrice)}</td>
                  <td className="align-right">{formatCurrency(position.marketValue)}</td>
                  <td className={`align-right ${pnl >= 0 ? 'positive' : 'negative'}`}>
                    {formatCurrency(pnl)}
                  </td>
                  <td className={`align-right ${pnlPercent >= 0 ? 'positive' : 'negative'}`}>
                    {formatPercent(pnlPercent)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {positions.length === 0 && (
          <div className="empty-state">
            <p>No positions found. Start trading to see your portfolio here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
