import React, { useState, useEffect, useMemo } from "react";
import StockDetailModal from "./StockDetailModal";
import ComparisonPanel from "./ComparisonPanel";
import "./StockMetrics.css";

// The component will load a tickers list from the public folder (public/nyse_tickers.json)
// This file should contain an array of symbols (e.g. ["AAPL","MSFT",...]) and can
// be replaced with a full list of NYSE symbols when you have it. Loading from the
// public folder makes it easy to swap out without rebuilding the app.

export default function StockMetrics() {
  const [stocks, setStocks] = useState([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "marketCap",
    direction: "desc",
  });
  const [selectedStock, setSelectedStock] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState([]);
  const [visibleColumns, setVisibleColumns] = useState([
    "symbol",
    "name",
    "price",
    "change",
    "changePercent",
    "marketCap",
    "peRatio",
    "volume",
    "rsi",
    "dividendYield",
  ]);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = "https://europitch-trading-prices.vercel.app"; // change if needed
  // Chunk size for backend requests to avoid very long query strings
  const FETCH_CHUNK_SIZE = 50;

  const allColumns = [
    { key: "symbol", label: "Symbol", format: "text" },
    { key: "name", label: "Name", format: "text" },
    { key: "sector", label: "Sector", format: "text" },
    { key: "price", label: "Price", format: "currency" },
    { key: "change", label: "Change", format: "currency" },
    { key: "changePercent", label: "Change %", format: "percent" },
    { key: "marketCap", label: "Market Cap", format: "marketCap" },
    { key: "volume", label: "Volume", format: "volume" },
    { key: "peRatio", label: "P/E", format: "decimal" },
    { key: "pbRatio", label: "P/B", format: "decimal" },
    { key: "pegRatio", label: "PEG", format: "decimal" },
    { key: "dividendYield", label: "Div Yield", format: "percent" },
    { key: "roe", label: "ROE", format: "percent" },
    { key: "roa", label: "ROA", format: "percent" },
    { key: "debtToEquity", label: "D/E", format: "decimal" },
    { key: "currentRatio", label: "Current Ratio", format: "decimal" },
    { key: "grossMargin", label: "Gross Margin", format: "percent" },
    { key: "operatingMargin", label: "Op Margin", format: "percent" },
    { key: "netMargin", label: "Net Margin", format: "percent" },
    { key: "revenueGrowth", label: "Rev Growth", format: "percent" },
    { key: "earningsGrowth", label: "Earnings Growth", format: "percent" },
    { key: "rsi", label: "RSI", format: "decimal" },
    { key: "beta", label: "Beta", format: "decimal" },
  ];

  // Fetch on mount + background refresh every 5s without UI flicker
  useEffect(() => {
    // Behavior:
    // 1) Load tickers list from public/nyse_tickers.json (if available).
    // 2) Batch requests to the backend in chunks, merge results.
    // 3) Keep a short background refresh without UI flicker.

    let isFirst = true;
    let intervalId: any;

    const loadTickersFile = async () => {
      try {
        // public/nyse_tickers.json should be placed in the app's public folder
        const res = await fetch("/nyse_tickers.json");
        if (!res.ok) return [];
        const json = await res.json();
        if (Array.isArray(json)) return json as string[];
        // If the file is an object mapping name->symbol, extract values
        if (typeof json === "object" && json !== null)
          return Object.values(json) as string[];
        return [];
      } catch (e) {
        console.warn("Could not load /nyse_tickers.json", e);
        return [];
      }
    };

    const fetchStocks = async () => {
      try {
        if (isFirst) setLoading(true);

        // If we don't have a tickers list yet, attempt to load it
        let symbols = tickers;
        if (!symbols || symbols.length === 0) {
          symbols = await loadTickersFile();
          // fallback: if no file found, use a small default sample
          if (!symbols || symbols.length === 0) {
            symbols = ["AAPL", "MSFT", "JPM", "JNJ", "TSLA"];
          }
          setTickers(symbols);
        }

        // Batch the requests into chunks to avoid extremely long URLs
        const chunks: string[][] = [];
        for (let i = 0; i < symbols.length; i += FETCH_CHUNK_SIZE) {
          chunks.push(symbols.slice(i, i + FETCH_CHUNK_SIZE));
        }

        const results: any[] = [];

        for (const chunk of chunks) {
          const params = new URLSearchParams();
          chunk.forEach((sym) => params.append("symbols", sym));
          params.append("chunk_size", String(FETCH_CHUNK_SIZE));

          const res = await fetch(
            `${API_BASE_URL}/equities/quotes?${params.toString()}`
          );
          if (!res.ok) {
            console.warn("Chunk fetch failed", res.status);
            continue;
          }
          const json = await res.json();
          const data = Object.values(json.data || {});
          results.push(...data);
        }

        const stocksArray = results.map((row: any, idx: number) => ({
          id: idx + 1,
          symbol: row.symbol || "",
          name: row.name || row.symbol || "",
          sector: row.sector || "Unknown",
          price: row.price || 0,
          change:
            row.price && row.previous_close
              ? row.price - row.previous_close
              : 0,
          changePercent:
            row.price && row.previous_close
              ? ((row.price - row.previous_close) / row.previous_close) * 100
              : 0,
          marketCap: row.market_cap || 0,
          volume: row.volume || 0,
          peRatio: row.pe_ratio || null,
          pbRatio: row.pb_ratio || null,
          pegRatio: row.peg_ratio || null,
          dividendYield: row.dividend_yield ? row.dividend_yield * 100 : null,
          roe: row.roe ? row.roe * 100 : null,
          roa: row.roa ? row.roa * 100 : null,
          debtToEquity: row.debt_to_equity || null,
          currentRatio: row.current_ratio || null,
          quickRatio: null,
          grossMargin: row.gross_margin ? row.gross_margin * 100 : null,
          operatingMargin: row.operating_margin
            ? row.operating_margin * 100
            : null,
          netMargin: row.net_margin ? row.net_margin * 100 : null,
          revenueGrowth: row.revenue_growth ? row.revenue_growth * 100 : null,
          earningsGrowth: row.earnings_growth
            ? row.earnings_growth * 100
            : null,
          rsi: row.rsi || null,
          beta: row.beta || null,
          fiftyTwoWeekHigh: row["52_week_high"] || null,
          fiftyTwoWeekLow: row["52_week_low"] || null,
          avgVolume: null,
        }));

        setStocks(stocksArray);
      } catch (err) {
        console.error("Failed to load market data", err);
      } finally {
        if (isFirst) {
          setLoading(false);
          isFirst = false;
        }
      }
    };

    // Initial load
    fetchStocks();
    // Background refresh every 10 seconds (less aggressive when loading many symbols)
    intervalId = setInterval(fetchStocks, 10000);

    return () => {
      clearInterval(intervalId);
    };
  }, [API_BASE_URL]);

  const sectors = ["all", ...new Set(stocks.map((s) => s.sector))];

  // Track collapsed state for each sector (true -> collapsed)
  const [collapsedSectors, setCollapsedSectors] = useState<
    Record<string, boolean>
  >({});

  const toggleSectorCollapse = (sector: string) => {
    setCollapsedSectors((prev) => ({ ...prev, [sector]: !prev[sector] }));
  };

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = stocks.filter((stock) => {
      const matchesSearch =
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSector =
        sectorFilter === "all" || stock.sector === sectorFilter;

      return matchesSearch && matchesSector;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [stocks, searchTerm, sectorFilter, sortConfig]);

  // Group filtered stocks by sector for display (must be a hook call before any early returns)
  const groupedBySector = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredAndSortedStocks.forEach((s) => {
      const sec = s.sector || "Unknown";
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(s);
    });
    return groups;
  }, [filteredAndSortedStocks]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return "-";

    switch (format) {
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value);

      case "marketCap":
        if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        return `$${value.toFixed(0)}`;

      case "volume":
        if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
        return value.toLocaleString();

      case "percent":
        return `${value.toFixed(2)}%`;

      case "decimal":
        return value.toFixed(2);

      default:
        return value;
    }
  };

  const getCellClassName = (columnKey, value) => {
    if (columnKey === "change" || columnKey === "changePercent") {
      return value >= 0 ? "positive" : "negative";
    }
    if (columnKey === "rsi") {
      if (value > 70) return "rsi-overbought";
      if (value < 30) return "rsi-oversold";
    }
    return "";
  };

  const handleCompareToggle = (stockId) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(stockId)) {
        return prev.filter((id) => id !== stockId);
      } else if (prev.length < 5) {
        return [...prev, stockId];
      }
      return prev;
    });
  };

  const toggleColumnVisibility = (columnKey) => {
    setVisibleColumns((prev) => {
      if (prev.includes(columnKey)) {
        if (columnKey === "symbol" || columnKey === "name") return prev;
        return prev.filter((key) => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const exportToCSV = () => {
    const headers = allColumns
      .filter((col) => visibleColumns.includes(col.key))
      .map((col) => col.label);

    const rows = filteredAndSortedStocks.map((stock) =>
      allColumns
        .filter((col) => visibleColumns.includes(col.key))
        .map((col) => stock[col.key])
    );

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-metrics-${new Date().toISOString().split("T")[0]}.csv`;
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
              className={`btn-compare ${compareMode ? "active" : ""}`}
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? "Exit Compare Mode" : "Compare Stocks"}
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
            <svg
              className="search-icon"
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
            >
              <path
                d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector === "all" ? "All Sectors" : sector}
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
              {allColumns.map((column) => (
                <label key={column.key} className="column-checkbox">
                  <input
                    type="checkbox"
                    checked={visibleColumns.includes(column.key)}
                    onChange={() => toggleColumnVisibility(column.key)}
                    disabled={column.key === "symbol" || column.key === "name"}
                  />
                  <span>{column.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="metrics-table-wrapper">
        {Object.keys(groupedBySector).length === 0 && (
          <div className="empty-state">
            <p>No stocks match your search criteria.</p>
          </div>
        )}

        {Object.entries(groupedBySector).map(([sector, sectorStocks]) => (
          <div key={sector} className="sector-group">
            <div className="sector-header">
              <button
                className="sector-toggle"
                onClick={() => toggleSectorCollapse(sector)}
              >
                {collapsedSectors[sector] ? "+" : "−"}
              </button>
              <h2 className="sector-title">
                {sector} ({sectorStocks.length})
              </h2>
            </div>

            {!collapsedSectors[sector] && (
              <table className="metrics-table">
                <thead>
                  <tr>
                    {compareMode && <th className="compare-col">Compare</th>}
                    {allColumns
                      .filter((col) => visibleColumns.includes(col.key))
                      .map((column) => (
                        <th
                          key={column.key}
                          onClick={() => requestSort(column.key)}
                          className={`sortable ${
                            sortConfig.key === column.key ? "active" : ""
                          }`}
                        >
                          <div className="th-content">
                            {column.label}
                            <span className="sort-indicator">
                              {sortConfig.key === column.key &&
                                (sortConfig.direction === "asc" ? "↑" : "↓")}
                            </span>
                          </div>
                        </th>
                      ))}
                    <th className="action-col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorStocks.map((stock) => (
                    <tr key={stock.id} className="stock-row">
                      {compareMode && (
                        <td className="compare-col">
                          <input
                            type="checkbox"
                            checked={selectedForCompare.includes(stock.id)}
                            onChange={() => handleCompareToggle(stock.id)}
                            disabled={
                              !selectedForCompare.includes(stock.id) &&
                              selectedForCompare.length >= 5
                            }
                          />
                        </td>
                      )}
                      {allColumns
                        .filter((col) => visibleColumns.includes(col.key))
                        .map((column) => (
                          <td
                            key={column.key}
                            className={`${column.key}-cell ${getCellClassName(
                              column.key,
                              stock[column.key]
                            )}`}
                          >
                            {column.key === "symbol" ? (
                              <strong>{stock[column.key]}</strong>
                            ) : column.key === "name" ? (
                              <span className="company-name">
                                {stock[column.key]}
                              </span>
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
            )}
          </div>
        ))}
      </div>

      {compareMode && selectedForCompare.length > 0 && (
        <ComparisonPanel
          stocks={stocks.filter((s) => selectedForCompare.includes(s.id))}
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
