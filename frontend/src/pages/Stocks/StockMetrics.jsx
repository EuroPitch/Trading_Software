import React, { useState, useEffect, useMemo } from 'react';
import StockDetailModal from './StockDetailModal';
import ComparisonPanel from './ComparisonPanel';
import './StockMetrics.css';

export default function StockMetrics() {
  const [stocks, setStocks] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'marketCap', direction: 'desc' });
  const [selectedStock, setSelectedStock] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([
    'symbol', 'name', 'price', 'change', 'changePercent', 'marketCap', 
    'peRatio', 'volume', 'rsi', 'dividendYield'
  ]);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sectorFilter, setSectorFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  // Mock data - replace with your API endpoint
  useEffect(() => {
    setTimeout(() => {
      const mockStocks = [
        {
          id: 1,
          symbol: 'AAPL',
          name: 'Apple Inc.',
          sector: 'Technology',
          price: 185.50,
          change: 2.50,
          changePercent: 1.37,
          marketCap: 2890000000000,
          volume: 52340000,
          peRatio: 29.5,
          pbRatio: 45.2,
          pegRatio: 2.8,
          dividendYield: 0.52,
          roe: 147.3,
          roa: 27.8,
          debtToEquity: 1.97,
          currentRatio: 0.98,
          quickRatio: 0.83,
          grossMargin: 43.8,
          operatingMargin: 29.8,
          netMargin: 25.3,
          revenueGrowth: 8.6,
          earningsGrowth: 13.4,
          rsi: 58.3,
          beta: 1.28,
          fiftyTwoWeekHigh: 199.62,
          fiftyTwoWeekLow: 164.08,
          avgVolume: 54200000
        },
        {
          id: 2,
          symbol: 'MSFT',
          name: 'Microsoft Corporation',
          sector: 'Technology',
          price: 378.90,
          change: -3.20,
          changePercent: -0.84,
          marketCap: 2820000000000,
          volume: 28670000,
          peRatio: 35.8,
          pbRatio: 13.2,
          pegRatio: 2.3,
          dividendYield: 0.78,
          roe: 42.6,
          roa: 18.4,
          debtToEquity: 0.45,
          currentRatio: 1.77,
          quickRatio: 1.73,
          grossMargin: 69.8,
          operatingMargin: 41.5,
          netMargin: 34.1,
          revenueGrowth: 12.7,
          earningsGrowth: 18.2,
          rsi: 52.1,
          beta: 0.89,
          fiftyTwoWeekHigh: 398.35,
          fiftyTwoWeekLow: 309.45,
          avgVolume: 31200000
        },
        {
          id: 3,
          symbol: 'JPM',
          name: 'JPMorgan Chase & Co.',
          sector: 'Financials',
          price: 158.30,
          change: 1.85,
          changePercent: 1.18,
          marketCap: 454000000000,
          volume: 12450000,
          peRatio: 11.2,
          pbRatio: 1.8,
          pegRatio: 1.5,
          dividendYield: 2.41,
          roe: 16.8,
          roa: 1.3,
          debtToEquity: 1.32,
          currentRatio: 0.92,
          quickRatio: 0.88,
          grossMargin: 62.3,
          operatingMargin: 38.7,
          netMargin: 31.2,
          revenueGrowth: 6.4,
          earningsGrowth: 11.8,
          rsi: 64.7,
          beta: 1.15,
          fiftyTwoWeekHigh: 168.42,
          fiftyTwoWeekLow: 135.19,
          avgVolume: 13800000
        },
        {
          id: 4,
          symbol: 'JNJ',
          name: 'Johnson & Johnson',
          sector: 'Healthcare',
          price: 162.45,
          change: 0.75,
          changePercent: 0.46,
          marketCap: 387000000000,
          volume: 8920000,
          peRatio: 24.3,
          pbRatio: 5.9,
          pegRatio: 3.2,
          dividendYield: 3.12,
          roe: 24.8,
          roa: 10.2,
          debtToEquity: 0.58,
          currentRatio: 1.32,
          quickRatio: 0.97,
          grossMargin: 68.4,
          operatingMargin: 24.6,
          netMargin: 18.7,
          revenueGrowth: 5.3,
          earningsGrowth: 7.6,
          rsi: 48.9,
          beta: 0.62,
          fiftyTwoWeekHigh: 172.89,
          fiftyTwoWeekLow: 143.56,
          avgVolume: 9600000
        },
        {
          id: 5,
          symbol: 'TSLA',
          name: 'Tesla, Inc.',
          sector: 'Consumer Discretionary',
          price: 242.80,
          change: -5.40,
          changePercent: -2.18,
          marketCap: 772000000000,
          volume: 118340000,
          peRatio: 67.3,
          pbRatio: 15.8,
          pegRatio: 4.1,
          dividendYield: 0.00,
          roe: 23.5,
          roa: 9.8,
          debtToEquity: 0.17,
          currentRatio: 1.73,
          quickRatio: 1.28,
          grossMargin: 18.2,
          operatingMargin: 9.2,
          netMargin: 8.4,
          revenueGrowth: 18.8,
          earningsGrowth: 27.3,
          rsi: 45.2,
          beta: 2.04,
          fiftyTwoWeekHigh: 299.29,
          fiftyTwoWeekLow: 138.80,
          avgVolume: 125600000
        }
      ];
      
      setStocks(mockStocks);
      setLoading(false);
    }, 500);
  }, []);

  const allColumns = [
    { key: 'symbol', label: 'Symbol', format: 'text' },
    { key: 'name', label: 'Name', format: 'text' },
    { key: 'sector', label: 'Sector', format: 'text' },
    { key: 'price', label: 'Price', format: 'currency' },
    { key: 'change', label: 'Change', format: 'currency' },
    { key: 'changePercent', label: 'Change %', format: 'percent' },
    { key: 'marketCap', label: 'Market Cap', format: 'marketCap' },
    { key: 'volume', label: 'Volume', format: 'volume' },
    { key: 'peRatio', label: 'P/E', format: 'decimal' },
    { key: 'pbRatio', label: 'P/B', format: 'decimal' },
    { key: 'pegRatio', label: 'PEG', format: 'decimal' },
    { key: 'dividendYield', label: 'Div Yield', format: 'percent' },
    { key: 'roe', label: 'ROE', format: 'percent' },
    { key: 'roa', label: 'ROA', format: 'percent' },
    { key: 'debtToEquity', label: 'D/E', format: 'decimal' },
    { key: 'currentRatio', label: 'Current Ratio', format: 'decimal' },
    { key: 'grossMargin', label: 'Gross Margin', format: 'percent' },
    { key: 'operatingMargin', label: 'Op Margin', format: 'percent' },
    { key: 'netMargin', label: 'Net Margin', format: 'percent' },
    { key: 'revenueGrowth', label: 'Rev Growth', format: 'percent' },
    { key: 'earningsGrowth', label: 'Earnings Growth', format: 'percent' },
    { key: 'rsi', label: 'RSI', format: 'decimal' },
    { key: 'beta', label: 'Beta', format: 'decimal' }
  ];

  const sectors = ['all', ...new Set(stocks.map(s => s.sector))];

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = stocks.filter(stock => {
      const matchesSearch = 
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSector = sectorFilter === 'all' || stock.sector === sectorFilter;
      
      return matchesSearch && matchesSector;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [stocks, searchTerm, sectorFilter, sortConfig]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

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
      
      case 'marketCap':
        if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        return `$${value.toFixed(0)}`;
      
      case 'volume':
        if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
        return value.toLocaleString();
      
      case 'percent':
        return `${value.toFixed(2)}%`;
      
      case 'decimal':
        return value.toFixed(2);
      
      default:
        return value;
    }
  };

  const getCellClassName = (columnKey, value) => {
    if (columnKey === 'change' || columnKey === 'changePercent') {
      return value >= 0 ? 'positive' : 'negative';
    }
    if (columnKey === 'rsi') {
      if (value > 70) return 'rsi-overbought';
      if (value < 30) return 'rsi-oversold';
    }
    return '';
  };

  const handleCompareToggle = (stockId) => {
    setSelectedForCompare(prev => {
      if (prev.includes(stockId)) {
        return prev.filter(id => id !== stockId);
      } else if (prev.length < 5) {
        return [...prev, stockId];
      }
      return prev;
    });
  };

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns(prev => {
      if (prev.includes(columnKey)) {
        // Don't allow hiding symbol and name
        if (columnKey === 'symbol' || columnKey === 'name') return prev;
        return prev.filter(key => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const exportToCSV = () => {
    const headers = allColumns
      .filter(col => visibleColumns.includes(col.key))
      .map(col => col.label);
    
    const rows = filteredAndSortedStocks.map(stock =>
      allColumns
        .filter(col => visibleColumns.includes(col.key))
        .map(col => stock[col.key])
    );

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-metrics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="metrics-container">
        <div className="loading-spinner">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="metrics-container">
      <div className="metrics-header">
        <div className="header-top">
          <h1>Market Metrics & Analysis</h1>
          <div className="header-actions">
            <button 
              className={`btn-compare ${compareMode ? 'active' : ''}`}
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? 'Exit Compare Mode' : 'Compare Stocks'}
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
            >
              Customize Columns
            </button>
            <button className="btn-secondary" onClick={exportToCSV}>
              Export CSV
            </button>
          </div>
        </div>

        <div className="filters-row">
          <div className="search-box">
            <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              placeholder="Search by symbol or company name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          <select 
            className="sector-filter"
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
          >
            {sectors.map(sector => (
              <option key={sector} value={sector}>
                {sector === 'all' ? 'All Sectors' : sector}
              </option>
            ))}
          </select>

          <div className="results-count">
            {filteredAndSortedStocks.length} of {stocks.length} stocks
          </div>
        </div>

        {showColumnCustomizer && (
          <div className="column-customizer">
            <div className="customizer-header">
              <h3>Customize Visible Columns</h3>
              <button 
                className="btn-close"
                onClick={() => setShowColumnCustomizer(false)}
              >
                ×
              </button>
            </div>
            <div className="column-options">
              {allColumns.map(column => (
                <label key={column.key} className="column-checkbox">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    onChange={() => toggleColumnVisibility(column.key)}
                    disabled={column.key === 'symbol' || column.key === 'name'}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="metrics-table-wrapper">
        <table className="metrics-table">
          <thead>
            <tr>
              {compareMode && <th className="compare-col">Compare</th>}
              {allColumns
                .filter(col => visibleColumns.includes(col.key))
                .map(column => (
                  <th 
                    key={column.key}
                    onClick={() => requestSort(column.key)}
                    className={`sortable ${sortConfig.key === column.key ? 'active' : ''}`}
                  >
                    <div className="th-content">
                      {column.label}
                      <span className="sort-indicator">
                        {sortConfig.key === column.key && (
                          sortConfig.direction === 'asc' ? '↑' : '↓'
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              <th className="action-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSortedStocks.map(stock => (
              <tr key={stock.id} className="stock-row">
                {compareMode && (
                  <td className="compare-col">
                    <input
                      type="checkbox"
                      checked={selectedForCompare.includes(stock.id)}
                      onChange={() => handleCompareToggle(stock.id)}
                      disabled={!selectedForCompare.includes(stock.id) && selectedForCompare.length >= 5}
                    />
                  </td>
                )}
                {allColumns
                  .filter(col => visibleColumns.includes(col.key))
                  .map(column => (
                    <td 
                      key={column.key}
                      className={`${column.key}-cell ${getCellClassName(column.key, stock[column.key])}`}
                    >
                      {column.key === 'symbol' ? (
                        <strong>{stock[column.key]}</strong>
                      ) : column.key === 'name' ? (
                        <span className="company-name">{stock[column.key]}</span>
                      ) : (
                        formatValue(stock[column.key], column.format)
                      )}
                    </td>
                  ))}
                <td className="action-col">
                  <button
                    className="btn-details"
                    onClick={() => setSelectedStock(stock)}
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredAndSortedStocks.length === 0 && (
          <div className="empty-state">
            <p>No stocks match your search criteria.</p>
          </div>
        )}
      </div>

      {compareMode && selectedForCompare.length > 0 && (
        <ComparisonPanel
          stocks={stocks.filter(s => selectedForCompare.includes(s.id))}
          onClose={() => {
            setCompareMode(false);
            setSelectedForCompare([]);
          }}
        />
      )}

      {selectedStock && (
        <StockDetailModal
          stock={selectedStock}
          onClose={() => setSelectedStock(null)}
        />
      )}
    </div>
  );
}