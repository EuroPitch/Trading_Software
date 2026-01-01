import React, { useState, useEffect, useRef } from "react";
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
  quantity: number;
  costBasis: number;
  entryPrice: number;
  positionType: "LONG" | "SHORT";
  currentPrice: number;
  unrealized_pnl: number;
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [positions, setPositions] = useState<Position[]>([]);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
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

  const fetchPrices = async (symbols: string[]): Promise<Map<string, number>> => {
    const map = new Map<string, number>();
    if (symbols.length === 0) return map;

    try {
      const symbolParams = symbols.map((s) => `symbols=${s}`).join("&");
      const priceResponse = await fetch(
        `https://europitch-trading-prices.vercel.app/equities/quotes?${symbolParams}&chunk_size=50`
      );
      if (!priceResponse.ok) return map;

      const priceData = await priceResponse.json();
      if (Array.isArray(priceData)) {
        priceData.forEach((item: any) => {
          const symbol = (item.symbol ?? item.ticker ?? "").toUpperCase().trim();
          const price = Number(item.price ?? item.last ?? item.close ?? 0);
          if (symbol && price > 0) map.set(symbol, price);
        });
      } else {
        Object.entries(priceData).forEach(([key, data]: [string, any]) => {
          const symbol = key.toUpperCase().trim();
          const price = Number(data.price ?? data.last ?? data.close ?? 0);
          if (symbol && price > 0) map.set(symbol, price);
        });
      }
    } catch (err) {
      console.error("Failed to fetch prices:", err);
    }
    return map;
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

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data: profileData } = await supabase
        .from("profiles")
        .select("initial_capital")
        .eq("id", userId)
        .single();

      const initialCapital = profileData?.initial_capital ?? 100000;

      const { data: tradesData, error: tradesError } = await supabase
        .from("trades")
        .select("*")
        .eq("profile_id", userId)
        .order("placed_at", { ascending: true });

      if (tradesError) throw tradesError;

      const trades = tradesData ?? [];

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

      const cashBalance = initialCapital - totalCostBasis + totalProceeds;

      const positionsMap = new Map<string, Position>();

      trades.forEach((trade: any) => {
        const symbol = (trade.symbol ?? "").toUpperCase().trim();
        const side = (trade.side ?? "buy").toLowerCase();
        const quantity = Number(trade.quantity ?? 0);
        const price = Number(trade.price ?? 0);
        const notional = Number(trade.notional ?? quantity * price);

        if (!positionsMap.has(symbol)) {
          positionsMap.set(symbol, {
            symbol,
            quantity: 0,
            costBasis: 0,
            entryPrice: 0,
            positionType: "LONG",
            currentPrice: 0,
            unrealized_pnl: 0,
          });
        }

        const position = positionsMap.get(symbol)!;

        if (side === "buy") {
          const oldQuantity = position.quantity;
          const oldCost = position.costBasis;

          position.quantity += quantity;
          position.costBasis = oldCost + notional;

          if (position.quantity > 0) {
            position.entryPrice = position.costBasis / position.quantity;
            position.positionType = "LONG";
          } else if (position.quantity < 0) {
            position.entryPrice = price;
            position.positionType = "SHORT";
          }
        } else if (side === "sell") {
          const oldQuantity = position.quantity;
          position.quantity -= quantity;

          if (oldQuantity > 0) {
            const remainingRatio =
              oldQuantity !== 0 ? position.quantity / oldQuantity : 0;
            position.costBasis = position.costBasis * Math.max(0, remainingRatio);

            if (position.quantity > 0) {
              position.entryPrice = position.costBasis / position.quantity;
              position.positionType = "LONG";
            } else if (position.quantity < 0) {
              position.entryPrice = price;
              position.positionType = "SHORT";
              position.costBasis = Math.abs(position.quantity) * price;
            }
          } else {
            position.entryPrice = price;
            position.positionType = "SHORT";
            position.costBasis = Math.abs(position.quantity) * price;
          }
        }
      });

      const aggregatedPositions = Array.from(positionsMap.values()).filter(
        (pos) => pos.quantity !== 0
      );

      const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];
      const prices = await fetchPrices(symbols);
      setPriceMap(prices);

      const positionsWithPrices = aggregatedPositions.map((pos) => {
        const currentPrice = prices.get(pos.symbol.toUpperCase().trim()) ?? 0;
        const unrealizedPnL = calculatePnL(pos, currentPrice);
        return {
          ...pos,
          currentPrice,
          unrealized_pnl: unrealizedPnL,
        };
      });

      setPositions(positionsWithPrices);

      let totalMarketValue = 0;
      let totalUnrealizedPnL = 0;

      positionsWithPrices.forEach((pos) => {
        if (pos.currentPrice > 0) {
          const quantity = Math.abs(pos.quantity);
          const marketValue = quantity * pos.currentPrice;
          totalMarketValue += marketValue;
          totalUnrealizedPnL += pos.unrealized_pnl;
        }
      });

      const totalEquity = cashBalance + totalMarketValue;
      const totalPnL = totalEquity - initialCapital;
      const totalPnLPercent = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;

      setSummary({
        totalValue: totalEquity,
        totalPnL,
        totalPnLPercent,
        cashBalance,
        initialCapital,
        positionCount: aggregatedPositions.length,
      });

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
        const s = t.symbol ?? "";
        if (s) stockCounts.set(s, (stockCounts.get(s) ?? 0) + 1);
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
    } catch (err: any) {
      console.error("Error fetching dashboard data:", err?.message ?? err);
      setError(err?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchDashboardData();

    if (priceIntervalRef.current) {
      clearInterval(priceIntervalRef.current);
    }

    priceIntervalRef.current = setInterval(async () => {
      if (positions.length > 0 && session?.user?.id) {
        const symbols = [...new Set(positions.map((p) => p.symbol))];
        const prices = await fetchPrices(symbols);
        setPriceMap(prices);
        
        const positionsWithPrices = positions.map((pos) => {
          const currentPrice = prices.get(pos.symbol.toUpperCase().trim()) ?? 0;
          const unrealizedPnL = calculatePnL(pos, currentPrice);
          return {
            ...pos,
            currentPrice,
            unrealized_pnl: unrealizedPnL,
          };
        });

        setPositions(positionsWithPrices);

        const { data: tradesData } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", session.user.id)
          .order("placed_at", { ascending: true });

        const trades = tradesData ?? [];
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

        const initialCapital = summary.initialCapital;
        const cashBalance = initialCapital - totalCostBasis + totalProceeds;

        let totalMarketValue = 0;
        positionsWithPrices.forEach((pos) => {
          if (pos.currentPrice > 0) {
            const quantity = Math.abs(pos.quantity);
            const marketValue = quantity * pos.currentPrice;
            totalMarketValue += marketValue;
          }
        });

        const totalEquity = cashBalance + totalMarketValue;
        const totalPnL = totalEquity - initialCapital;
        const totalPnLPercent = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;

        setSummary({
          totalValue: totalEquity,
          totalPnL,
          totalPnLPercent,
          cashBalance,
          initialCapital,
          positionCount: positionsWithPrices.length,
        });
      }
    }, 15_000);

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
        priceIntervalRef.current = null;
      }
    };
  }, [session, authLoading, positions.length, summary.initialCapital]);

  const userEmail = session?.user?.email || localStorage.getItem("userEmail") || "User";

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>Welcome back, {userEmail.split("@")[0]}!</h1>
          <p className="welcome-subtitle">Here's an overview of your trading account</p>
        </div>
        <button className="dashboard-logout-button" onClick={handleLogout}>
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
              <span className="summary-value large">{formatCurrency(summary.totalValue)}</span>
              <span
                className={`summary-change ${summary.totalPnLPercent >= 0 ? "positive" : "negative"}`}
              >
                {formatPercent(summary.totalPnLPercent)}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Total P&L</span>
              <span className={`summary-value ${summary.totalPnL >= 0 ? "positive" : "negative"}`}>
                {formatCurrency(summary.totalPnL)}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Cash Balance</span>
              <span className="summary-value">{formatCurrency(summary.cashBalance)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Active Positions</span>
              <span className="summary-value">{summary.positionCount}</span>
            </div>
          </div>

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
              <div className="action-card">
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
