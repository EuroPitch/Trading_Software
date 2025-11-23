import React from 'react';
import './ComparisonPanel.css';

export default function ComparisonPanel({ stocks, onClose }) {
  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-';
    
    switch(format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
      case 'percent':
        return `${value.toFixed(2)}%`;
      case 'decimal':
        return value.toFixed(2);
      case 'marketCap':
        if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        return `$${(value / 1e6).toFixed(2)}M`;
      default:
        return value;
    }
  };

  const metrics = [
    { key: 'price', label: 'Price', format: 'currency' },
    { key: 'changePercent', label: 'Change %', format: 'percent' },
    { key: 'marketCap', label: 'Market Cap', format: 'marketCap' },
    { key: 'peRatio', label: 'P/E Ratio', format: 'decimal' },
    { key: 'dividendYield', label: 'Div Yield', format: 'percent' },
    { key: 'roe', label: 'ROE', format: 'percent' },
    { key: 'debtToEquity', label: 'D/E Ratio', format: 'decimal' },
    { key: 'revenueGrowth', label: 'Rev Growth', format: 'percent' },
    { key: 'earningsGrowth', label: 'Earn Growth', format: 'percent' },
    { key: 'rsi', label: 'RSI', format: 'decimal' },
    { key: 'beta', label: 'Beta', format: 'decimal' }
  ];

  return (
    <div className="comparison-panel">
      <div className="comparison-header">
        <h3>Stock Comparison ({stocks.length})</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>
      
      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Metric</th>
              {stocks.map(stock => (
                <th key={stock.id}>
                  <div className="stock-header">
                    <strong>{stock.symbol}</strong>
                    <span className="stock-name-small">{stock.name}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(metric => (
              <tr key={metric.key}>
                <td className="metric-label-cell">{metric.label}</td>
                {stocks.map(stock => (
                  <td key={stock.id} className={metric.key === 'changePercent' && stock[metric.key] < 0 ? 'negative' : metric.key === 'changePercent' && stock[metric.key] >= 0 ? 'positive' : ''}>
                    {formatValue(stock[metric.key], metric.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}