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
  entryPrice: number;
  positionType: "LONG" | "SHORT";
  unrealized_pnl: number;
  priceStale?: boolean;
};


export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingPricesRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastKnownPricesRef = useRef<Map<string, number>>(new Map());


  const [positions, setPositions] = useState<Position[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  const [initialCapital, setInitialCapital] = useState(100000);
  const [cashBalance, setCashBalance] = useState(0);
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
  const [societyName, setSocietyName] = useState("Society");


  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userEmail");
      navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };


  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UK", { style: "currency", currency: "EUR" }).format(value);


  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;


  const calculatePnL = useCallback((position: Position, currentPrice: number): number => {
    if (currentPrice === 0 || position.entryPrice === 0 || position.quantity === 0) {
      return 0;
    }


    const quantity = Math.abs(position.quantity);
    if (position.positionType === "LONG") {
      return (currentPrice - position.entryPrice) * quantity;
    } else {
      return (position.entryPrice - currentPrice) * quantity;
    }
  }, []);


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
        `https://trading-software.onrender.com/equities/quotes?${symbolParams}&chunk_size=50`,
        { signal: AbortSignal.timeout(10000) }
      );


      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        console.log("📦 API Response:", JSON.stringify(priceData, null, 2));


        // Handle nested structure with "data" wrapper
        if (priceData.data && typeof priceData.data === "object") {
          Object.entries(priceData.data).forEach(([symbol, stockData]: [string, any]) => {
            const price = Number(stockData?.price ?? 0);
            if (symbol && price > 0) {
              priceMap.set(symbol.toUpperCase().trim(), price);
              lastKnownPricesRef.current.set(symbol.toUpperCase().trim(), price);
            }
          });
        }
        // Fallback: array format
        else if (Array.isArray(priceData)) {
          priceData.forEach((item: any) => {
            const symbol = (item.symbol ?? item.ticker ?? "").toUpperCase().trim();
            const price = Number(item.price ?? item.last ?? item.close ?? item.current ?? 0);
            if (symbol && price > 0) {
              priceMap.set(symbol, price);
              lastKnownPricesRef.current.set(symbol, price);
            }
          });
        }
        // Fallback: direct object format
        else if (typeof priceData === "object") {
          Object.entries(priceData).forEach(([key, data]: [string, any]) => {
            if (key === "provider" || key === "symbols") return;
            const symbol = key.toUpperCase().trim();
            const price = Number(data.price ?? data.last ?? data.close ?? data.current ?? 0);
            if (symbol && price > 0) {
              priceMap.set(symbol, price);
              lastKnownPricesRef.current.set(symbol, price);
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


  const calculatePnLForDisplay = useCallback((position: Position) => {
    const currentPrice = priceMap.get(position.symbol.toUpperCase().trim()) ?? position.currentPrice;
    return calculatePnL(position, currentPrice);
  }, [priceMap, calculatePnL]);


  const calculatePnLPercent = useCallback((position: Position) => {
    const pnl = calculatePnLForDisplay(position);
    const costBasis = Math.abs(position.costBasis ?? 0);
    if (costBasis === 0) return 0;
    return (pnl / costBasis) * 100;
  }, [calculatePnLForDisplay]);


  // Sync portfolio to database
  const syncPortfolioToDatabase = useCallback(async (userId: string, totalEquity: number, realizedPnL: number) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          total_equity: totalEquity,
          realized_pnl: realizedPnL
        })
        .eq('id', userId);

      if (error) {
        console.error('❌ Failed to sync portfolio to DB:', error);
      } else {
        console.log('✅ Portfolio synced to DB - Total Equity:', totalEquity, 'Realized P&L:', realizedPnL);
      }
    } catch (err) {
      console.error('❌ Error syncing portfolio:', err);
    }
  }, []);


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


        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("society_name, initial_capital")
            .eq("id", userId)
            .single();


          if (profileData?.initial_capital) {
            initialCapital = Number(profileData.initial_capital);
          }
          if (profileData?.society_name) {
            fetchedSocietyName = profileData.society_name;
            setSocietyName(fetchedSocietyName);
          }
        } catch (err) {
          console.warn("Could not fetch profile data, using defaults");
        }


        const { data: tradesData, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId)
          .order("placed_at", { ascending: true });


        if (fetchError) throw fetchError;


        const trades = tradesData ?? [];
        const symbolNameMap = new Map<string, string>();


        // Calculate cash balance from trades
        let totalCostBasis = 0;
        let totalProceeds = 0;


        trades.forEach((trade: any) => {
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);


          if (side === "buy") {
            totalCostBasis += notional;
          } else if (side === "sell") {
            totalProceeds += notional;
          }
        });


        const calculatedCashBalance = initialCapital - totalCostBasis + totalProceeds;


        // Build positions map
        const positionsMap = new Map<string, any>();


        trades.forEach((trade: any) => {
          const symbol = (trade.symbol ?? "").toUpperCase().trim();
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);


          if (trade.name) {
            symbolNameMap.set(symbol, trade.name);
          }


          if (!positionsMap.has(symbol)) {
            positionsMap.set(symbol, {
              symbol,
              quantity: 0,
              costBasis: 0,
              entryPrice: 0,
              positionType: "LONG",
            });
          }


          const position = positionsMap.get(symbol)!;


          if (side === "buy") {
            position.quantity += quantity;
            position.costBasis += notional;
          } else if (side === "sell") {
            const oldQuantity = position.quantity;
            const oldCostBasis = position.costBasis;


            position.quantity -= quantity;


            // Reducing a long position (staying long)
            if (oldQuantity > 0 && position.quantity >= 0) {
              if (oldQuantity > 0) {
                const avgCost = oldCostBasis / oldQuantity;
                position.costBasis = position.quantity * avgCost;
              } else {
                position.costBasis = 0;
              }
            }
            // Flipping from long to short
            else if (oldQuantity > 0 && position.quantity < 0) {
              position.costBasis = Math.abs(position.quantity) * price;
            }
            // Adding to existing short
            else if (oldQuantity <= 0) {
              position.costBasis += notional;
            }
          }
        });


        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => Math.abs(pos.quantity) > 0.0001
        );


        setInitialCapital(initialCapital);
        setCashBalance(calculatedCashBalance);


        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];


        // Create positions with fallback prices
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
            unrealized_pnl: 0,
          };
        });


        setPositions(detailedPositions);


        // Calculate summary
        let totalMarketValue = 0;


        detailedPositions.forEach((pos) => {
          totalMarketValue += pos.marketValue;
        });


        const totalEquityCalculated = calculatedCashBalance + totalMarketValue;
        const totalPnLCalculated = totalEquityCalculated - initialCapital;
        const totalReturn = initialCapital === 0 ? 0 : (totalPnLCalculated / initialCapital) * 100;


        setSummary({
          totalValue: totalEquityCalculated,
          totalPnL: totalPnLCalculated,
          totalPnLPercent: totalReturn,
          cashBalance: calculatedCashBalance,
          initialCapital,
          positionCount: detailedPositions.length,
        });


        // Calculate trading stats
        const buyTrades = trades.filter((t: any) => (t.side ?? "buy").toLowerCase() === "buy").length;
        const sellTrades = trades.filter((t: any) => (t.side ?? "sell").toLowerCase() === "sell").length;
        const totalVolume = trades.reduce((sum: number, t: any) => sum + Math.abs(Number(t.quantity ?? 0)), 0);
        const totalNotional = trades.reduce(
          (sum: number, t: any) => sum + Number(t.notional ?? (Number(t.quantity ?? 0) * Number(t.price ?? 0))),
          0
        );
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


        // Non-blocking price fetch
        console.log("🔄 Fetching initial prices (non-blocking)...");
        if (symbols.length > 0) {
          const prices = await fetchPrices(symbols);
          if (prices.size > 0) {
            setPriceMap(prices);


            const updatedPositions = detailedPositions.map((pos) => {
              const freshPrice = prices.get(pos.symbol);
              if (freshPrice && freshPrice > 0) {
                return {
                  ...pos,
                  currentPrice: freshPrice,
                  marketValue: Math.abs(pos.quantity) * freshPrice,
                  priceStale: false,
                };
              }
              return pos;
            });


            setPositions(updatedPositions);


            // Recalculate summary with fresh prices
            let updatedTotalMarketValue = 0;


            updatedPositions.forEach((pos) => {
              updatedTotalMarketValue += pos.marketValue;
            });


            const updatedTotalEquity = calculatedCashBalance + updatedTotalMarketValue;
            const updatedTotalPnLCalc = updatedTotalEquity - initialCapital;
            const updatedTotalReturn = initialCapital === 0 ? 0 : (updatedTotalPnLCalc / initialCapital) * 100;


            setSummary({
              totalValue: updatedTotalEquity,
              totalPnL: updatedTotalPnLCalc,
              totalPnLPercent: updatedTotalReturn,
              cashBalance: calculatedCashBalance,
              initialCapital,
              positionCount: updatedPositions.length,
            });
          }
        }


        // Set up price polling interval (30 seconds)
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


  // Separate effect to update positions when priceMap changes (from interval)
  useEffect(() => {
    if (positions.length === 0 || priceMap.size === 0) return;


    const updatedPositions = positions.map((pos) => {
      const freshPrice = priceMap.get(pos.symbol);
      if (freshPrice && freshPrice > 0 && freshPrice !== pos.currentPrice) {
        return {
          ...pos,
          currentPrice: freshPrice,
          marketValue: Math.abs(pos.quantity) * freshPrice,
          priceStale: false,
        };
      }
      return pos;
    });


    // Only update if prices actually changed
    const hasChanges = updatedPositions.some((pos, idx) => 
      pos.currentPrice !== positions[idx].currentPrice
    );


    if (hasChanges) {
      setPositions(updatedPositions);


      // Recalculate summary
      let totalMarketValue = 0;
      updatedPositions.forEach((pos) => {
        totalMarketValue += pos.marketValue;
      });


      const totalEquity = cashBalance + totalMarketValue;
      const totalPnL = totalEquity - initialCapital;
      const totalReturn = initialCapital === 0 ? 0 : (totalPnL / initialCapital) * 100;


      setSummary((prev) => ({
        ...prev,
        totalValue: totalEquity,
        totalPnL: totalPnL,
        totalPnLPercent: totalReturn,
        positionCount: updatedPositions.length,
      }));
    }
  }, [priceMap]); // ONLY depend on priceMap, not positions or summary


  // Sync portfolio to database when summary changes
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || summary.totalValue === 0 || loading) return;


    // Debounce to avoid excessive DB writes (wait 3 seconds after last change)
    const timeoutId = setTimeout(() => {
      syncPortfolioToDatabase(userId, summary.totalValue, summary.totalPnL);
    }, 3000);


    return () => clearTimeout(timeoutId);
  }, [summary.totalValue, summary.totalPnL, session?.user?.id, loading, syncPortfolioToDatabase]);


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
            <div className={`summary-card main-card ${summary.totalPnLPercent >= 0 ? 'positive' : 'negative'}`}>
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
            <div className={`summary-card ${summary.totalPnL >= 0 ? 'positive' : 'negative'}`}>
              <span className="summary-label">Total P&L</span>
              <div className="summary-value">
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
                  <tr><td>Total Trades</td><td className="align-right">{tradingStats.totalTrades}</td></tr>
                  <tr><td>Buy Orders</td><td className="align-right positive">{tradingStats.buyTrades}</td></tr>
                  <tr><td>Sell Orders</td><td className="align-right negative">{tradingStats.sellTrades}</td></tr>
                  <tr><td>Total Volume</td><td className="align-right">{tradingStats.totalVolume.toLocaleString()}</td></tr>
                  <tr><td>Total Notional</td><td className="align-right">{formatCurrency(tradingStats.totalNotional)}</td></tr>
                  <tr><td>Avg Trade Size</td><td className="align-right">{formatCurrency(tradingStats.averageTradeSize)}</td></tr>
                  <tr><td>Most Traded Stock</td><td className="align-right">{tradingStats.mostTradedStock} ({tradingStats.mostTradedCount})</td></tr>
                  <tr><td>Trades Today</td><td className="align-right">{tradingStats.tradesToday}</td></tr>
                  <tr><td>Trades This Week</td><td className="align-right">{tradingStats.tradesThisWeek}</td></tr>
                </tbody>
              </table>
            </div>
          </div>


          <div className="dashboard-actions">
            <h2>Quick Actions</h2>
            <div className="action-cards">
              <Link to="/portfolio" className="action-card">
                <div className="action-icon">📊</div>
                <h3>View Portfolio</h3>
                <p>See all your positions and detailed performance</p>
              </Link>
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