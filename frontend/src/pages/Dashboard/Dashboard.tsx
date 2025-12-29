import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Dashboard.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

type PortfolioSummary = {
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  cashBalance: number;
  initialCapital: number;
  positionCount: number;
};

type TradingStats = {
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  totalVolume: number;
  averageTradeSize: number;
  mostTradedStock: string;
  mostTradedCount: number;
  tradesToday: number;
  tradesThisWeek: number;
  totalNotional: number;
};

type Position = {
  symbol: string;
  name?: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  positionType: string;
  entryPrice: number;
  priceStale?: boolean;
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingPricesRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const lastKnownPricesRef = useRef<Map<string, number>>(new Map());
  const [initialCapital, setInitialCapital] = useState(100000);
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    cashBalance: 0,
    initialCapital: 100000,
    positionCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradingStats, setTradingStats] = useState<TradingStats>({
    totalTrades: 0,
    buyTrades: 0,
    sellTrades: 0,
    totalVolume: 0,
    averageTradeSize: 0,
    mostTradedStock: "-",
    mostTradedCount: 0,
    tradesToday: 0,
    tradesThisWeek: 0,
    totalNotional: 0,
  });
  const [societyName, setSocietyName] = useState<string>("Society");

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userEmail");
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-UK", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const calculatePnL = (position: Position, currentPrice: number): number => {
    if (currentPrice === 0 || position.entryPrice === 0 || position.quantity === 0) {
      return 0;
    }

    const quantity = Math.abs(position.quantity);

    if (position.positionType === "LONG") {
      return (currentPrice - position.entryPrice) * quantity;
    } else {
      return (position.entryPrice - currentPrice) * quantity;
    }
  };

  // FIXED: Handle nested API response structure with "data" wrapper
  const fetchPrices = useCallback(async (symbols: string[]): Promise<Map<string, number>> => {
    if (isFetchingPricesRef.current) {
      console.log("⏭️ Skipping price fetch - already in progress");
      return new Map();
    }

    const priceMap = new Map<string, number>();

    if (symbols.length === 0) return priceMap;

    isFetchingPricesRef.current = true;

    try {
      const symbolParams = symbols.map((s) => `symbols=${s}`).join("&");
      console.log(`🔄 Fetching prices for: ${symbols.join(", ")}`);

      const priceResponse = await fetch(
        `http://127.0.0.1:5000/equities/quotes?${symbolParams}&chunk_size=50`,
        {
          signal: AbortSignal.timeout(10000)
        }
      );

      if (priceResponse.ok) {
        const priceData = await priceResponse.json();

        console.log("📦 API Response:", JSON.stringify(priceData, null, 2));

        // FIXED: Handle the nested structure with "data" wrapper
        if (priceData.data && typeof priceData.data === "object") {
          // Response format: { data: { NVDA: {...}, AAPL: {...} } }
          Object.entries(priceData.data).forEach(([symbol, stockData]: [string, any]) => {
            console.log(`🔍 Parsing symbol: ${symbol}`, stockData);

            const price = Number(stockData?.price ?? 0);

            console.log(`  Symbol: ${symbol}, Price: ${price}`);

            if (symbol && price > 0) {
              priceMap.set(symbol.toUpperCase().trim(), price);
              lastKnownPricesRef.current.set(symbol.toUpperCase().trim(), price);
              console.log(`✅ Stored price for ${symbol}: €${price}`);
            } else {
              console.warn(`⚠️ Invalid price data for ${symbol}:`, stockData);
            }
          });
        } 
        // Fallback: handle if data is returned at top level (backwards compatibility)
        else if (Array.isArray(priceData)) {
          priceData.forEach((item: any) => {
            const symbol = (item.symbol ?? item.ticker ?? "").toUpperCase().trim();
            const price = Number(
              item.price ?? 
              item.last ?? 
              item.close ?? 
              item.current ?? 
              0
            );

            if (symbol && price > 0) {
              priceMap.set(symbol, price);
              lastKnownPricesRef.current.set(symbol, price);
              console.log(`✅ Stored price for ${symbol}: €${price}`);
            }
          });
        } else if (typeof priceData === "object") {
          // Direct object format: { NVDA: {...}, AAPL: {...} }
          Object.entries(priceData).forEach(([key, data]: [string, any]) => {
            // Skip metadata fields
            if (key === "provider" || key === "symbols") return;

            const symbol = key.toUpperCase().trim();
            const price = Number(
              data.price ?? 
              data.last ?? 
              data.close ?? 
              data.current ?? 
              0
            );

            if (symbol && price > 0) {
              priceMap.set(symbol, price);
              lastKnownPricesRef.current.set(symbol, price);
              console.log(`✅ Stored price for ${symbol}: €${price}`);
            }
          });
        }

        console.log(`✅ Successfully fetched ${priceMap.size} prices`);
      } else {
        console.error(`❌ API returned status ${priceResponse.status}`);
      }
    } catch (priceError: any) {
      console.error("❌ Failed to fetch prices:", priceError.message);
    } finally {
      isFetchingPricesRef.current = false;
    }

    return priceMap;
  }, []);

  const calculatePnLForDisplay = (position: Position) => {
    const currentPrice = priceMap.get(position.symbol.toUpperCase().trim()) ?? position.currentPrice;
    return calculatePnL(position, currentPrice);
  };

  const calculatePnLPercent = (position: Position) => {
    const pnl = calculatePnLForDisplay(position);
    const costBasis = Math.abs(position.costBasis ?? 0);
    if (costBasis === 0) return 0;
    return (pnl / costBasis) * 100;
  };

  useEffect(() => {
    if (hasInitializedRef.current) {
      console.log("⏭️ Already initialized, skipping");
      return;
    }

    const fetchDashboardData = async () => {
      console.log("🚀 Initializing dashboard...");
      setLoading(true);
      setError(null);

      try {
        const userId = session?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        hasInitializedRef.current = true;

        let initialCapital = 100000;
        let fetchedSocietyName = "Society";
        let totalEquity = 100000;

        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("society_name, initial_capital, total_equity")
            .eq("id", userId)
            .single();

          if (profileData?.initial_capital) {
            initialCapital = Number(profileData.initial_capital);
          }

          if (profileData?.society_name) {
            fetchedSocietyName = profileData.society_name;
            setSocietyName(fetchedSocietyName);
          }

          if (profileData?.total_equity) {
            totalEquity = Number(profileData.total_equity);
          }
        } catch (err) {
          console.warn("Could not fetch profile data, using defaults");
        }

        const { data: tradesData, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId)
          .order("placed_at", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        const positionsMap = new Map();
        const symbolNameMap = new Map();

        console.log("Fetched trades:", tradesData?.length || 0);

        (tradesData ?? []).forEach((trade: any) => {
          const symbol = (trade.symbol ?? "").toUpperCase().trim();
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);

          const key = symbol;

          if (trade.name) {
            symbolNameMap.set(symbol, trade.name);
          }

          if (!positionsMap.has(key)) {
            positionsMap.set(key, {
              symbol,
              quantity: 0,
              costBasis: 0,
              entryPrice: 0,
              positionType: "LONG",
            });
          }

          const position = positionsMap.get(key)!;

          if (side === "buy") {
            position.quantity += quantity;
            position.costBasis += notional;
          } else if (side === "sell") {
            const oldQuantity = position.quantity;
            const oldCostBasis = position.costBasis;

            position.quantity -= quantity;

            if (oldQuantity > 0 && position.quantity >= 0) {
              if (oldQuantity > 0) {
                const avgCost = oldCostBasis / oldQuantity;
                position.costBasis = position.quantity * avgCost;
              } else {
                position.costBasis = 0;
              }
            } else if (oldQuantity > 0 && position.quantity < 0) {
              position.costBasis = Math.abs(position.quantity) * price;
            } else if (oldQuantity <= 0) {
              position.costBasis += notional;
            }
          }
        });

        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => Math.abs(pos.quantity) > 0.0001
        );

        setInitialCapital(initialCapital);

        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];

        const detailedPositions: Position[] = aggregatedPositions.map((pos) => {
          const entryPrice =
            pos.quantity !== 0 ? Math.abs(pos.costBasis) / Math.abs(pos.quantity) : 0;

          const lastKnownPrice = lastKnownPricesRef.current.get(pos.symbol);
          const currentPrice = lastKnownPrice && lastKnownPrice > 0 ? lastKnownPrice : entryPrice;
          const priceStale = !lastKnownPrice || lastKnownPrice === 0;

          const marketValue = Math.abs(pos.quantity) * currentPrice;

          return {
            symbol: pos.symbol,
            name: symbolNameMap.get(pos.symbol) || pos.symbol,
            quantity: pos.quantity,
            costBasis: pos.costBasis,
            currentPrice: currentPrice,
            marketValue: marketValue,
            entryPrice: entryPrice,
            positionType: pos.quantity > 0 ? "LONG" : "SHORT",
            priceStale: priceStale,
          };
        });

        setPositions(detailedPositions);

        let totalPnL = 0;
        detailedPositions.forEach((pos) => {
          totalPnL += calculatePnL(pos, pos.currentPrice);
        });

        const totalCostBasis = detailedPositions.reduce(
          (sum, pos) => sum + Math.abs(pos.costBasis),
          0
        );
        const cashBalance = initialCapital - totalCostBasis;
        const totalReturn = initialCapital === 0 ? 0 : ((totalEquity - initialCapital) / initialCapital) * 100;

        setSummary({
          totalValue: totalEquity,
          totalPnL,
          totalPnLPercent: totalReturn,
          cashBalance,
          initialCapital,
          positionCount: detailedPositions.length,
        });

        const trades = tradesData ?? [];
        const buyTrades = trades.filter((t: any) => (t.side ?? "buy").toLowerCase() === "buy").length;
        const sellTrades = trades.filter((t: any) => (t.side ?? "sell").toLowerCase() === "sell").length;
        const totalVolume = trades.reduce((sum: number, t: any) => sum + Number(t.quantity ?? 0), 0);
        const totalNotional = trades.reduce((sum: number, t: any) => sum + Number(t.notional ?? (Number(t.quantity ?? 0) * Number(t.price ?? 0))), 0);
        const averageTradeSize = trades.length > 0 ? totalNotional / trades.length : 0;

        const stockCounts = new Map<string, number>();
        trades.forEach((t: any) => {
          const symbol = t.symbol ?? "";
          if (symbol) {
            stockCounts.set(symbol, (stockCounts.get(symbol) ?? 0) + 1);
          }
        });
        let mostTradedStock = "-";
        let mostTradedCount = 0;
        stockCounts.forEach((count, symbol) => {
          if (count > mostTradedCount) {
            mostTradedCount = count;
            mostTradedStock = symbol;
          }
        });

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        const tradesToday = trades.filter((t: any) => {
          const tradeDate = new Date(t.placed_at ?? t.filled_at ?? "");
          return tradeDate >= today;
        }).length;

        const tradesThisWeek = trades.filter((t: any) => {
          const tradeDate = new Date(t.placed_at ?? t.filled_at ?? "");
          return tradeDate >= weekAgo;
        }).length;

        setTradingStats({
          totalTrades: trades.length,
          buyTrades,
          sellTrades,
          totalVolume,
          averageTradeSize,
          mostTradedStock,
          mostTradedCount,
          tradesToday,
          tradesThisWeek,
          totalNotional,
        });

        console.log("🔄 Fetching initial prices (non-blocking)...");
        if (symbols.length > 0) {
          const prices = await fetchPrices(symbols);
          if (prices.size > 0) {
            setPriceMap(prices);

            const updatedPositions = detailedPositions.map(pos => {
              const freshPrice = prices.get(pos.symbol);
              if (freshPrice && freshPrice > 0) {
                return {
                  ...pos,
                  currentPrice: freshPrice,
                  marketValue: Math.abs(pos.quantity) * freshPrice,
                  priceStale: false
                };
              }
              return pos;
            });

            setPositions(updatedPositions);
          }
        }

        if (priceIntervalRef.current) {
          clearInterval(priceIntervalRef.current);
        }

        if (symbols.length > 0) {
          priceIntervalRef.current = setInterval(async () => {
            console.log("⏰ Polling prices...");
            const prices = await fetchPrices(symbols);
            if (prices.size > 0) {
              setPriceMap(prices);
            }
          }, 30_000);
        }

      } catch (err: any) {
        console.error("Error fetching dashboard data:", err?.message ?? err);
        setError(err?.message ?? "An error occurred while fetching dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading && session?.user?.id) {
      fetchDashboardData();
    }

    return () => {
      console.log("🧹 Cleaning up dashboard...");
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
      hasInitializedRef.current = false;
    };
  }, [session?.user?.id, authLoading, fetchPrices]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{societyName} Portfolio Dashboard</h1>
          <p className="welcome-subtitle">{"Here\'s an overview of your trading account"}</p>
        </div>
        <button onClick={handleLogout} className="dashboard-logout-button">
          Log Out
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          <div className="dashboard-summary">
            <div className="summary-card main-card">
              <span className="summary-label">Portfolio Value</span>
              <div className="summary-value large">
                {formatCurrency(summary.totalValue)}
              </div>
              <div
                className={`summary-change ${
                  summary.totalPnLPercent >= 0 ? "positive" : "negative"
                }`}
              >
                {formatPercent(summary.totalPnLPercent)}
              </div>
            </div>

            <div className="summary-card">
              <span className="summary-label">Total P&L</span>
              <div
                className={`summary-value ${
                  summary.totalPnL >= 0 ? "positive" : "negative"
                }`}
              >
                {formatCurrency(summary.totalPnL)}
              </div>
            </div>

            <div className="summary-card">
              <span className="summary-label">Cash Balance</span>
              <div className="summary-value">
                {formatCurrency(summary.cashBalance)}
              </div>
            </div>

            <div className="summary-card">
              <span className="summary-label">Active Positions</span>
              <div className="summary-value">{summary.positionCount}</div>
            </div>
          </div>

          {positions.length > 0 ? (
            <div className="positions-section">
              <h2 className="positions-title">Active Positions</h2>
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
                    {positions.map((position, idx) => {
                      const currentPrice = priceMap.get(position.symbol.toUpperCase().trim()) ?? position.currentPrice;
                      const pnl = calculatePnLForDisplay(position);
                      const pnlPercent = calculatePnLPercent(position);

                      return (
                        <tr key={`${position.symbol}-${idx}`} className="position-row">
                          <td className="symbol-cell">
                            <strong>{position.symbol}</strong>
                          </td>
                          <td className="name-cell">{position.name}</td>
                          <td>
                            <span
                              className={`position-badge ${position.positionType.toLowerCase()}`}
                            >
                              {position.positionType}
                            </span>
                          </td>
                          <td className="align-right">
                            {Math.abs(position.quantity).toFixed(2)}
                          </td>
                          <td className="align-right">
                            {formatCurrency(position.entryPrice ?? 0)}
                          </td>
                          <td className="align-right">
                            {formatCurrency(currentPrice)}
                            {position.priceStale && (
                              <span style={{fontSize: "0.75em", color: "#999", marginLeft: "4px"}}>
                                ⚠
                              </span>
                            )}
                          </td>
                          <td className="align-right">
                            {formatCurrency(Math.abs(position.quantity) * currentPrice)}
                          </td>
                          <td
                            className={`align-right ${
                              pnl >= 0 ? "positive" : "negative"
                            }`}
                          >
                            {formatCurrency(pnl)}
                          </td>
                          <td
                            className={`align-right ${
                              pnlPercent >= 0 ? "positive" : "negative"
                            }`}
                          >
                            {formatPercent(pnlPercent)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {positions.some(p => p.priceStale) && (
                <p style={{fontSize: "0.85em", color: "#666", marginTop: "0.5rem", fontStyle: "italic"}}>
                  ⚠ = Price may be stale or unavailable
                </p>
              )}
            </div>
          ) : (
            <div className="positions-section">
              <h2 className="positions-title">Active Positions</h2>
              <p style={{ textAlign: "center", padding: "2rem", color: "#666" }}>
                No active positions. Start trading to see your portfolio here.
              </p>
            </div>
          )}

          <div className="stats-overview">
            <h2>Trading Statistics</h2>
            <div className="stats-table-container">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="align-right">Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Trades</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.totalTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Buy Orders</td>
                    <td className="align-right">
                      <span className="stat-value positive">{tradingStats.buyTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Sell Orders</td>
                    <td className="align-right">
                      <span className="stat-value negative">{tradingStats.sellTrades}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Volume</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.totalVolume.toLocaleString()}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Notional</td>
                    <td className="align-right">
                      <span className="stat-value">{formatCurrency(tradingStats.totalNotional)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Avg Trade Size</td>
                    <td className="align-right">
                      <span className="stat-value">{formatCurrency(tradingStats.averageTradeSize)}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Most Traded Stock</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.mostTradedStock}</span>
                      {tradingStats.mostTradedCount > 0 && (
                        <span className="stat-sublabel"> ({tradingStats.mostTradedCount} trades)</span>
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Trades Today</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.tradesToday}</span>
                    </td>
                  </tr>
                  <tr>
                    <td>Trades This Week</td>
                    <td className="align-right">
                      <span className="stat-value">{tradingStats.tradesThisWeek}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="dashboard-actions">
            <h2>Quick Actions</h2>
            <div className="action-cards">
              <Link to="/stocks" className="action-card">
                <div className="action-icon">📈</div>
                <h3>Browse Stocks</h3>
                <p>Explore and trade stocks</p>
              </Link>

              <div className="action-card" style={{ cursor: "default" }}>
                <div className="action-icon">💰</div>
                <h3>Initial Capital</h3>
                <p>{formatCurrency(summary.initialCapital)}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}