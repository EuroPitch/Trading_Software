import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import StockDetailModal from "../StockDetailModal/StockDetailModal";
import ComparisonPanel from "../ComparisonPanel/ComparisonPanel";
import StockOrderModal from "../StockOrderModal/StockOrderModal";
import "./StockMetrics.css";

// TypeScript Interfaces
interface Stock {
  id: number;
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number | null;
  volume: number | null;
  peRatio: number | null;
  pbRatio: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  roe: number | null;
  roa: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  rsi: number | null;
  beta: number | null;
}

interface WebSocketMessage {
  type: string;
  data: Record<string, { price: number; change: number; changepercent: number }>;
}

interface MarketStatus {
  isOpen: boolean;
  status: string;
  nextChange: string;
}

interface SortConfig {
  key: string;
  direction: "asc" | "desc";
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Add Sentry or error logging here later
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We're sorry, but there was an error loading the stock metrics.</p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function StockMetricsContent() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [sectorMapping, setSectorMapping] = useState<Record<string, string>>({});
  const [nameMapping, setNameMapping] = useState<Record<string, string>>({});
  const [tickersLoadError, setTickersLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "marketCap", direction: "desc" });
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<number[]>([]);
  const [visibleColumns, setVisibleColumns] = useState([
    "symbol",
    "name",
    "price",
    "marketCap",
    "peRatio",
    "volume",
    "rsi",
    "dividendYield",
  ]);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sectorFilter, setSectorFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [marketStatus, setMarketStatus] = useState<MarketStatus>({
    isOpen: false,
    status: "Closed",
    nextChange: "",
  });

  // WebSocket connection state
  const [wsConnected, setWsConnected] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // Refs for intervals and WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const fetchIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const marketStatusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;
  const API_BASE_URL = "https://trading-software.onrender.com"; // Use https://trading-software.onrender.com when committing
  const FETCH_CHUNK_SIZE = 50;

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = API_BASE_URL.replace("http", "ws") + "/ws";
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
        setWsError(null);
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          if (message.type === "priceupdate") {
            setStocks((prevStocks) =>
              prevStocks.map((stock) => {
                const update = message.data[stock.symbol];
                if (update) {
                  return {
                    ...stock,
                    price: update.price,
                    change: update.change,
                    changePercent: update.changepercent,
                  };
                }
                return stock;
              })
            );
          }
        } catch (err) {
          setWsError("Error processing price update");
        }
      };

      ws.onerror = () => {
        setWsError("WebSocket connection error");
        setWsConnected(false);
      };

      ws.onclose = () => {
        setWsConnected(false);
        // Attempt to reconnect if we haven't exceeded max attempts
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current += 1;
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket();
          }, RECONNECT_DELAY);
        } else {
          setWsError("Failed to connect after multiple attempts");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      setWsError("Failed to initialize WebSocket");
    }
  }, [API_BASE_URL]);

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

  // Calculate time remaining using PROPER timezone handling
  const formatTimeRemaining = (targetTimeEST: Date): string => {
    const nowEST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const diffMs = targetTimeEST.getTime() - nowEST.getTime();

    if (diffMs <= 0) return "now";

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  // Check market status using ONLY EST timezone
  const checkMarketStatus = useCallback((): MarketStatus => {
    const nowEST = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = nowEST.getDay();
    const hours = nowEST.getHours();
    const minutes = nowEST.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    if (day === 0 || day === 6) {
      const nextMonday = new Date(nowEST);
      const daysUntilMonday = day === 0 ? 1 : 2;
      nextMonday.setDate(nowEST.getDate() + daysUntilMonday);
      nextMonday.setHours(9, 30, 0, 0);
      return {
        isOpen: false,
        status: "Closed (Weekend)",
        nextChange: `Opens in ${formatTimeRemaining(nextMonday)}`,
      };
    }

    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;
    const preMarketStart = 4 * 60;
    const afterHoursEnd = 20 * 60;

    if (timeInMinutes >= marketOpen && timeInMinutes < marketClose) {
      const closingTime = new Date(nowEST);
      closingTime.setHours(16, 0, 0, 0);
      return {
        isOpen: true,
        status: "Market Open",
        nextChange: `Closes in ${formatTimeRemaining(closingTime)}`,
      };
    } else if (timeInMinutes >= preMarketStart && timeInMinutes < marketOpen) {
      const openingTime = new Date(nowEST);
      openingTime.setHours(9, 30, 0, 0);
      return {
        isOpen: false,
        status: "Pre-Market",
        nextChange: `Opens in ${formatTimeRemaining(openingTime)}`,
      };
    } else if (timeInMinutes >= marketClose && timeInMinutes < afterHoursEnd) {
      const nextOpen = new Date(nowEST);
      if (day === 5) {
        nextOpen.setDate(nowEST.getDate() + 3);
      } else {
        nextOpen.setDate(nowEST.getDate() + 1);
      }
      nextOpen.setHours(9, 30, 0, 0);
      return {
        isOpen: false,
        status: "After Hours",
        nextChange: `Opens in ${formatTimeRemaining(nextOpen)}`,
      };
    } else {
      const nextOpen = new Date(nowEST);
      if (timeInMinutes >= afterHoursEnd) {
        if (day === 5) {
          nextOpen.setDate(nowEST.getDate() + 3);
        } else {
          nextOpen.setDate(nowEST.getDate() + 1);
        }
      }
      nextOpen.setHours(9, 30, 0, 0);
      return {
        isOpen: false,
        status: "Closed",
        nextChange: `Opens in ${formatTimeRemaining(nextOpen)}`,
      };
    }
  }, []);

  // Update market status every minute
  useEffect(() => {
    const updateMarketStatus = () => {
      setMarketStatus(checkMarketStatus());
    };

    updateMarketStatus();
    marketStatusIntervalRef.current = setInterval(updateMarketStatus, 60000);

    return () => {
      if (marketStatusIntervalRef.current) {
        clearInterval(marketStatusIntervalRef.current);
      }
    };
  }, [checkMarketStatus]);

  // Load tickers from API - USING EXACT NAMES FROM UNIVERSE.JSON
  useEffect(() => {
    let mounted = true;

    const loadTickers = async () => {
      try {
        console.log(`Fetching universe from ${API_BASE_URL}/equities/universe`);
        const res = await fetch(`${API_BASE_URL}/equities/universe`);

        if (!res.ok) {
          throw new Error(`Failed to load universe from API: ${res.status}`);
        }

        const json = await res.json();
        console.log("Universe response:", json);

        const symbols: string[] = [];
        const sectorMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};

        if (json && json.sectors && typeof json.sectors === "object") {
          Object.entries(json.sectors).forEach(([sectorKey, sectorData]: [string, any]) => {
            if (sectorData && sectorData.stocks && Array.isArray(sectorData.stocks)) {
              const sectorDisplayName = sectorData.name || sectorKey;
              sectorData.stocks.forEach((stock: any) => {
                if (stock && stock.ticker) {
                  symbols.push(stock.ticker);
                  sectorMap[stock.ticker] = sectorDisplayName;
                  if (stock.name) {
                    nameMap[stock.ticker] = stock.name;
                  }
                }
              });
            }
          });
        }

        console.log("Parsed symbols:", symbols.length, symbols);
        console.log("Parsed sector mapping:", sectorMap);
        console.log("Parsed name mapping:", nameMap);

        if (mounted) {
          if (symbols.length === 0) {
            setTickersLoadError("Ticker list is empty from API.");
          } else {
            setTickers(symbols);
            setSectorMapping(sectorMap);
            setNameMapping(nameMap);
          }
        }
      } catch (err: any) {
        console.error("Error loading tickers from API:", err);
        if (mounted) {
          setTickersLoadError(err.message || String(err));
        }
      }
    };

    loadTickers();
    return () => {
      mounted = false;
    };
  }, [API_BASE_URL]);

  // Memoized fetchStocks function
  const fetchStocks = useCallback(async () => {
    if (!tickers || tickers.length === 0) return;

    try {
      const symbols = tickers;
      const chunks: string[][] = [];
      for (let i = 0; i < symbols.length; i += FETCH_CHUNK_SIZE) {
        chunks.push(symbols.slice(i, i + FETCH_CHUNK_SIZE));
      }

      const fetchPromises = chunks.map(async (chunk) => {
        const params = new URLSearchParams();
        chunk.forEach((sym) => params.append("symbols", sym));
        const res = await fetch(`${API_BASE_URL}/equities/quotes?${params.toString()}`);
        if (!res.ok) return [];
        const json = await res.json();
        return Object.values(json.data || {});
      });

      const chunkResults = await Promise.all(fetchPromises);
      const results = chunkResults.flat();

      const stocksArray: Stock[] = results.map((row: any, idx: number) => {
        const symbol = row.symbol;
        const sector = sectorMapping[symbol] || "Unknown";
        const name = nameMapping[symbol] || symbol;

        return {
          id: idx + 1,
          symbol: symbol,
          name: name,
          sector: sector,
          price: row.price || 0,
          change: row.change || 0,
          changePercent: row.change_percent || 0,  // ← underscore
          marketCap: row.market_cap || 0,  // ← underscore
          volume: row.volume || 0,
          peRatio: row.pe_ratio || null,  // ← underscore
          pbRatio: row.price_to_book || null,  // ← completely different!
          pegRatio: row.peg_ratio || null,  // ← underscore
          dividendYield: row.dividend_yield || null,  // ← underscore
          roe: row.roe || null,
          roa: row.roa || null,
          debtToEquity: row.debt_to_equity || null,  // ← underscore
          currentRatio: row.current_ratio || null,  // ← underscore
          quickRatio: row.quick_ratio || null,  // ← underscore
          grossMargin: row.gross_margin || null,  // ← underscore
          operatingMargin: row.operating_margin || null,  // ← underscore
          netMargin: row.profit_margin || null,  // ← completely different!
          revenueGrowth: row.revenue_growth || null,  // ← underscore
          earningsGrowth: row.earnings_growth || null,  // ← underscore
          rsi: row.rsi || null,
          beta: row.beta || null,
          fiftyTwoWeekHigh: row["52week_high"] || null,  // ← bracket notation
          fiftyTwoWeekLow: row["52week_low"] || null,  // ← bracket notation
          avgVolume: row.avg_volume || null,  // ← underscore
        };
      });


      setStocks(stocksArray);
    } catch (err) {
      console.error("ERROR in fetchStocks:", err);
    }
  }, [tickers, sectorMapping, nameMapping, API_BASE_URL]);

  // Fetch prices/fundamentals with proper interval management
  useEffect(() => {
    if (tickersLoadError) return;
    if (!tickers || tickers.length === 0) return;

    let isFirst = true;

    const executeFetch = async () => {
      if (isFirst) {
        setLoading(true);
      }
      await fetchStocks();
      if (isFirst) {
        setLoading(false);
        isFirst = false;
      }
    };

    executeFetch();

    // Clear existing interval
    if (fetchIntervalRef.current) {
      clearInterval(fetchIntervalRef.current);
    }

    // Set up new interval
    fetchIntervalRef.current = setInterval(fetchStocks, 30000);

    return () => {
      if (fetchIntervalRef.current) {
        clearInterval(fetchIntervalRef.current);
      }
    };
  }, [tickers, tickersLoadError, fetchStocks]);

  const [collapsedSectors, setCollapsedSectors] = useState<Record<string, boolean>>({});

  const toggleSectorCollapse = (sector: string) => {
    setCollapsedSectors((prev) => ({
      ...prev,
      [sector]: !prev[sector],
    }));
  };

  const filteredAndSortedStocks = useMemo(() => {
    let filtered = stocks.filter((stock) => {
      const matchesSearch =
        stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        stock.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSector = sectorFilter === "all" || stock.sector === sectorFilter;
      return matchesSearch && matchesSector;
    });

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key as keyof Stock];
        const bVal = b[sortConfig.key as keyof Stock];
        if (aVal < bVal) return sortConfig.direction === "asc" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [stocks, searchTerm, sectorFilter, sortConfig]);

  const groupedBySector = useMemo(() => {
    const groups: Record<string, any> = {};
    filteredAndSortedStocks.forEach((s) => {
      const sec = s.sector || "Unknown";
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(s);
    });
    return groups;
  }, [filteredAndSortedStocks]);

  const sectors = ["all", ...Array.from(new Set(stocks.map((s) => s.sector || "Unknown")))];

  const requestSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const formatValue = (value: any, format: string) => {
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
        return `${(value * 1).toFixed(2)}%`;
      case "decimal":
        return value.toFixed(2);
      default:
        return value;
    }
  };

  const getCellClassName = (columnKey: string, value: any) => {
    if (columnKey === "change" || columnKey === "changePercent") {
      return value >= 0 ? "positive" : "negative";
    }
    if (columnKey === "rsi") {
      if (value >= 70) return "rsi-overbought";
      if (value <= 30) return "rsi-oversold";
    }
    return "";
  };

  const handleCompareToggle = (stockId: number) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(stockId)) {
        return prev.filter((id) => id !== stockId);
      } else if (prev.length < 5) {
        return [...prev, stockId];
      }
      return prev;
    });
  };

  const toggleColumnVisibility = (columnKey: string) => {
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
        .map((col) => stock[col.key as keyof Stock])
    );

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

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
          <div>
            <h1>Market Metrics Analysis</h1>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "14px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: marketStatus.isOpen ? "#10b981" : "#ef4444",
                }}
              ></span>
              <span style={{ fontWeight: 600 }}>{marketStatus.status}</span>
              <span style={{ color: "#6b7280" }}>{marketStatus.nextChange}</span>
            </div>
          </div>
          <div className="header-actions">
            <button
              className={`btn-compare ${compareMode ? "active" : ""}`}
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? "Exit Compare Mode" : "Compare Stocks"}
            </button>
            <button className="btn-secondary" onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}>
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
          <select className="sector-filter" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
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
              <button className="btn-close" onClick={() => setShowColumnCustomizer(false)}>
                ✕
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
        {Object.keys(groupedBySector).length === 0 ? (
          <div className="empty-state">
            <p>No stocks match your search criteria.</p>
          </div>
        ) : (
          Object.entries(groupedBySector).map(([sector, sectorStocks]) => (
            <div key={sector} className="sector-group">
              <div className="sector-header">
                <button className="sector-toggle" onClick={() => toggleSectorCollapse(sector)}>
                  {collapsedSectors[sector] ? "▶" : "▼"}
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
                            className={`sortable ${sortConfig.key === column.key ? "active" : ""}`}
                          >
                            <div className="th-content">
                              {column.label}
                              <span className="sort-indicator">
                                {sortConfig.key === column.key && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                              </span>
                            </div>
                          </th>
                        ))}
                      <th className="action-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectorStocks.map((stock: Stock) => (
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
                          .filter((col) => visibleColumns.includes(col.key))
                          .map((column) => (
                            <td
                              key={column.key}
                              className={`${column.key}-cell ${getCellClassName(column.key, stock[column.key as keyof Stock])}`}
                            >
                              {column.key === "symbol" ? (
                                <strong>{stock[column.key as keyof Stock]}</strong>
                              ) : column.key === "name" ? (
                                <span className="company-name">{stock[column.key as keyof Stock]}</span>
                              ) : (
                                formatValue(stock[column.key as keyof Stock], column.format)
                              )}
                            </td>
                          ))}
                        <td className="action-col">
                          <button className="btn-details" onClick={() => setSelectedStock(stock)}>
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))
        )}
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

      {selectedStock && <StockDetailModal stock={selectedStock} onClose={() => setSelectedStock(null)} />}
    </div>
  );
}

export default function StockMetrics() {
  return (
    <ErrorBoundary>
      <StockMetricsContent />
    </ErrorBoundary>
  );
}