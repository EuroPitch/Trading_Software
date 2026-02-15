import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import "./Dashboard.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";
import { useCompetitionScore } from "../../context/CompetitionScoreContext";
import { useWatchlist } from "../../context/WatchlistContext";

type PERatioPoint = {
  symbol: string;
  pe_ratio: number;
};

type EquityDataPoint = {
  date: string;
  equity: number;
};

type DailyPnLDataPoint = {
  date: string;
  pnl: number;
};

type AllocationDataPoint = {
  symbol: string;
  value: number;
};

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

type RiskMetrics = {
  sharpeRatio: number;
  volatility: number;
  maxDrawdown: number;
  var95: number;
  beta: number;
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

type PortfolioSnapshot = {
  timestamp: Date;
  totalEquity: number;
  dailyReturn: number;
};

type CompetitionScore = {
  returnScore: number;
  riskScore: number;
  consistencyScore: number;
  activityScore: number;
  totalScore: number;
};

export default function Dashboard() {
  const [realizedPnLData, setRealizedPnLData] = useState<
    { date: string; pnl: number }[]
  >([]);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const { session, loading: authLoading } = useAuth();
  const { watchlist: contextWatchlist, removeFromWatchlist } = useWatchlist();
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const { setCompetitionScore: setContextCompetitionScore } =
    useCompetitionScore();
  const navigate = useNavigate();
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingPricesRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const lastKnownPricesRef = useRef<Map<string, number>>(new Map());
  const portfolioSnapshotsRef = useRef<PortfolioSnapshot[]>([]);

  const hasUpdatedScoresRef = useRef(false);

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
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>({
    sharpeRatio: 0,
    volatility: 0,
    maxDrawdown: 0,
    var95: 0,
    beta: 0,
  });
  const [societyName, setSocietyName] = useState("Society");
  const [equityCurveData, setEquityCurveData] = useState<EquityDataPoint[]>([]);
  const [allocationData, setAllocationData] = useState<AllocationDataPoint[]>(
    [],
  );

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

  const handleClosePosition = async (position: Position) => {
    const userId = session?.user?.id;
    if (!userId) {
      setError("User session not found");
      return;
    }

    try {
      const currentPrice =
        priceMap.get(position.symbol.toUpperCase().trim()) ??
        position.currentPrice;

      // Calculate the cost to close the position
      const closingNotional = Math.abs(position.quantity) * currentPrice;

      // Check if closing a short position - need cash to buy back
      if (position.positionType === "SHORT") {
        if (cashBalance < closingNotional) {
          alert(
            `Insufficient funds to close short position. Please close existing long positions to close this short.
            \nYou need ${formatCurrency(closingNotional)} but only have ${formatCurrency(cashBalance)} available.`
          );
          return;
        }
      }

      // Create a closing trade (opposite side of the position)
      const closingTrade = {
        profile_id: userId,
        symbol: position.symbol,
        side: position.positionType === "LONG" ? "sell" : "buy",
        quantity: Math.abs(position.quantity),
        price: currentPrice,
        order_type: "market",
        placed_at: new Date().toISOString(),
        filled_at: new Date().toISOString(),
        status: "filled",
        created_by: userId,
      };

      // Insert the closing trade
      const { error: insertError } = await supabase
        .from("trades")
        .insert(closingTrade);

      if (insertError) throw insertError;

      // Now refresh the dashboard data (fetch all trades and recalculate)
      const { data: allTrades, error: fetchError } = await supabase
        .from("trades")
        .select("*")
        .eq("profile_id", userId)
        .order("placed_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Recalculate cash balance and positions
      const positionsMap = new Map<string, any>();
      let totalCostBasis = 0;
      let totalProceeds = 0;

      (allTrades ?? []).forEach((trade: any) => {
        const symbol = (trade.symbol ?? "").toUpperCase().trim();
        const side = (trade.side ?? "buy").toLowerCase();
        const quantity = Number(trade.quantity ?? 0);
        const price = Number(trade.price ?? 0);
        const notional = Number(trade.notional ?? quantity * price);

        // Track cash flow
        if (side === "buy") {
          totalCostBasis += notional;
        } else if (side === "sell") {
          totalProceeds += notional;
        }

        // Initialize position if needed
        if (!positionsMap.has(symbol)) {
          positionsMap.set(symbol, {
            symbol,
            quantity: 0,
            costBasis: 0,
          });
        }

        const position = positionsMap.get(symbol)!;
        const oldQuantity = position.quantity;
        const oldCostBasis = position.costBasis;

        if (side === "buy") {
          // Buying shares
          if (oldQuantity >= 0) {
            // Adding to long or opening long
            position.quantity += quantity;
            position.costBasis += notional;
          } else {
            // Covering a short
            position.quantity += quantity;
            
            if (position.quantity === 0) {
              // Fully covered short
              position.costBasis = 0;
            } else if (position.quantity > 0) {
              // Covered short and went long
              position.costBasis = position.quantity * price;
            } else {
              // Still short, reduce cost basis proportionally
              const coverRatio = position.quantity / oldQuantity;
              position.costBasis = oldCostBasis * coverRatio;
            }
          }
        } else if (side === "sell") {
          // Selling shares
          if (oldQuantity > 0) {
            // Reducing or closing long
            position.quantity -= quantity;
            
            if (position.quantity === 0) {
              // Fully closed long
              position.costBasis = 0;
            } else if (position.quantity > 0) {
              // Reduced long, adjust cost basis proportionally
              const avgCost = oldCostBasis / oldQuantity;
              position.costBasis = position.quantity * avgCost;
            } else {
              // Went from long to short
              position.costBasis = Math.abs(position.quantity) * price;
            }
          } else {
            // Opening or adding to short
            position.quantity -= quantity;
            
            if (oldQuantity === 0) {
              // Opening new short position
              position.costBasis = Math.abs(position.quantity) * price;
            } else {
              // Adding to existing short (weighted average)
              const oldShortQty = Math.abs(oldQuantity);
              const newShortQty = quantity;
              const totalShortQty = Math.abs(position.quantity);
              const oldAvgPrice = oldShortQty > 0 ? oldCostBasis / oldShortQty : 0;
              const weightedAvgPrice = 
                ((oldShortQty * oldAvgPrice) + (newShortQty * price)) / totalShortQty;
              position.costBasis = totalShortQty * weightedAvgPrice;
            }
          }
        }
      });

      const calculatedCashBalance = initialCapital - totalCostBasis + totalProceeds;
      setCashBalance(calculatedCashBalance);

      const aggregatedPositions = Array.from(positionsMap.values()).filter(
        (pos) => Math.abs(pos.quantity) > 0.0001,
      );

      // Update positions with current prices
      const updatedPositions: Position[] = aggregatedPositions.map((pos) => {
        const entryPrice = pos.quantity !== 0 ? pos.costBasis / Math.abs(pos.quantity) : 0;
        const currentPrice = priceMap.get(pos.symbol) ?? entryPrice;
        const marketValue = pos.quantity * currentPrice;

        return {
          symbol: pos.symbol,
          name: pos.symbol,
          quantity: pos.quantity,
          costBasis: pos.costBasis,
          currentPrice: currentPrice,
          marketValue: marketValue,
          entryPrice: entryPrice,
          positionType: pos.quantity > 0 ? "LONG" : "SHORT",
          priceStale: false,
          unrealized_pnl: 0,
        };
      });

      setPositions(updatedPositions);

      // Recalculate summary
      const totalMarketValue = updatedPositions.reduce(
        (sum, p) => sum + p.marketValue,
        0,
      );
      const totalEquity = calculatedCashBalance + totalMarketValue;
      const totalPnL = totalEquity - initialCapital;
      const totalReturn =
        initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;

      setSummary({
        totalValue: totalEquity,
        totalPnL: totalPnL,
        totalPnLPercent: totalReturn,
        cashBalance: calculatedCashBalance,
        initialCapital,
        positionCount: updatedPositions.length,
      });

      setError(null);
      console.log(`Position closed for ${position.symbol}`);
    } catch (err: any) {
      console.error("Error closing position:", err);
      setError(`Failed to close position: ${err?.message || "Unknown error"}`);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatAxisCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatPercent = (value: number) =>
    `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  /** Equity curve from trades only: sort by placed_at ASC, start at initial_capital, BUY -> equity -= notional, SELL -> equity += notional */
  const calculateEquityCurve = useCallback(
    (trades: any[], initCapital: number): EquityDataPoint[] => {
      const sorted = [...(trades ?? [])].sort(
        (a, b) =>
          new Date(a.placed_at ?? 0).getTime() -
          new Date(b.placed_at ?? 0).getTime(),
      );
      let equity = initCapital;
      const points: EquityDataPoint[] = [];
      const startDate =
        sorted.length > 0
          ? new Date(sorted[0].placed_at).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10);
      points.push({ date: startDate, equity: initCapital });
      sorted.forEach((t: any) => {
        const side = (t.side ?? "buy").toLowerCase();
        const notional = Number(
          t.notional ?? Number(t.quantity ?? 0) * Number(t.price ?? 0),
        );
        if (side === "buy") equity -= notional;
        else if (side === "sell") equity += notional;
        const date = new Date(t.placed_at ?? 0).toISOString().slice(0, 10);
        points.push({ date, equity });
      });
      return points;
    },
    [],
  );

  /** Daily realized P&L from trades: group by day, pnl = sum(SELL notional) - sum(BUY notional) per day */
  const calculateDailyPnL = useCallback(
    (trades: any[]): DailyPnLDataPoint[] => {
      const byDay = new Map<string, number>();
      (trades ?? []).forEach((t: any) => {
        const date = new Date(t.placed_at ?? 0).toISOString().slice(0, 10);
        const notional = Number(
          t.notional ?? Number(t.quantity ?? 0) * Number(t.price ?? 0),
        );
        const side = (t.side ?? "buy").toLowerCase();
        const current = byDay.get(date) ?? 0;
        if (side === "sell") byDay.set(date, current + notional);
        else if (side === "buy") byDay.set(date, current - notional);
      });
      return Array.from(byDay.entries())
        .map(([date, pnl]) => ({ date, pnl }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    [],
  );

  const calculatePnL = useCallback(
    (position: Position, currentPrice: number): number => {
      if (
        currentPrice === 0 ||
        position.entryPrice === 0 ||
        position.quantity === 0
      ) {
        return 0;
      }

      const quantity = Math.abs(position.quantity);
      if (position.positionType === "LONG") {
        return (currentPrice - position.entryPrice) * quantity;
      } else {
        return (position.entryPrice - currentPrice) * quantity;
      }
    },
    [],
  );

  const [competitionScore, setCompetitionScoreLocal] =
    useState<CompetitionScore>({
      returnScore: 0,
      riskScore: 0,
      consistencyScore: 0,
      activityScore: 0,
      totalScore: 0,
    });

  const setCompetitionScore = (score: CompetitionScore) => {
    setCompetitionScoreLocal(score);
    setContextCompetitionScore(score);
  };
  useEffect(() => {
    if (contextWatchlist.length >= 0) {
      setWatchlist(contextWatchlist);
    }
  }, [contextWatchlist]);

  const fetchPrices = useCallback(
    async (symbols: string[]): Promise<Map<string, number>> => {
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
          { signal: AbortSignal.timeout(10000) },
        );

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          console.log("📦 API Response:", JSON.stringify(priceData, null, 2));

          if (priceData.data && typeof priceData.data === "object") {
            Object.entries(priceData.data).forEach(
              ([symbol, stockData]: [string, any]) => {
                const price = Number(stockData?.price ?? 0);
                if (symbol && price > 0) {
                  priceMap.set(symbol.toUpperCase().trim(), price);
                  lastKnownPricesRef.current.set(
                    symbol.toUpperCase().trim(),
                    price,
                  );
                }
              },
            );
          } else if (Array.isArray(priceData)) {
            priceData.forEach((item: any) => {
              const symbol = (item.symbol ?? item.ticker ?? "")
                .toUpperCase()
                .trim();
              const price = Number(
                item.price ?? item.last ?? item.close ?? item.current ?? 0,
              );
              if (symbol && price > 0) {
                priceMap.set(symbol, price);
                lastKnownPricesRef.current.set(symbol, price);
              }
            });
          } else if (typeof priceData === "object") {
            Object.entries(priceData).forEach(([key, data]: [string, any]) => {
              if (key === "provider" || key === "symbols") return;
              const symbol = key.toUpperCase().trim();
              const price = Number(
                data.price ?? data.last ?? data.close ?? data.current ?? 0,
              );
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
    },
    [],
  );

  const calculatePnLForDisplay = useCallback(
    (position: Position) => {
      const currentPrice =
        priceMap.get(position.symbol.toUpperCase().trim()) ??
        position.currentPrice;
      return calculatePnL(position, currentPrice);
    },
    [priceMap, calculatePnL],
  );

  const calculatePnLPercent = useCallback(
    (position: Position) => {
      const pnl = calculatePnLForDisplay(position);
      const costBasis = Math.abs(position.costBasis ?? 0);
      if (costBasis === 0) return 0;
      return (pnl / costBasis) * 100;
    },
    [calculatePnLForDisplay],
  );

  // Calculate risk metrics from portfolio snapshots with HOURLY data
  const calculateRiskMetrics = useCallback(
    (
      snapshots: PortfolioSnapshot[],
      currentEquity: number,
      initCapital: number,
    ) => {
      if (snapshots.length < 2) {
        setRiskMetrics({
          sharpeRatio: 0,
          volatility: 0,
          maxDrawdown: 0,
          var95: 0,
          beta: 0,
        });
        return;
      }

      const returns: number[] = [];
      for (let i = 1; i < snapshots.length; i++) {
        const prevEquity = snapshots[i - 1].totalEquity;
        const currEquity = snapshots[i].totalEquity;
        if (prevEquity > 0) {
          returns.push((currEquity - prevEquity) / prevEquity);
        }
      }

      if (returns.length === 0) {
        setRiskMetrics({
          sharpeRatio: 0,
          volatility: 0,
          maxDrawdown: 0,
          var95: 0,
          beta: 0,
        });
        return;
      }

      // Mean return
      const meanReturn =
        returns.reduce((sum, r) => sum + r, 0) / returns.length;

      // Standard deviation
      const variance =
        returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
        returns.length;
      const stdDev = Math.sqrt(variance);

      // Sharpe Ratio - HOURLY calculation (252 trading days * 6.5 hours = ~1638 trading hours/year)
      const tradingHoursPerYear: number = 252 * 6.5;
      const hourlyRiskFreeRate: number = 0.04 / tradingHoursPerYear; // 4% annual risk-free rate
      const sharpe =
        stdDev === 0
          ? 0
          : ((meanReturn - hourlyRiskFreeRate) / stdDev) *
            Math.sqrt(tradingHoursPerYear);

      // Annualized volatility - HOURLY calculation
      const annualizedVol = stdDev * Math.sqrt(tradingHoursPerYear) * 100;

      // VaR at 95% confidence (5th percentile)
      const sortedReturns = [...returns].sort((a, b) => a - b);
      const varIndex = Math.max(0, Math.floor(returns.length * 0.05));
      const var95Hourly = sortedReturns[varIndex] || 0;
      const var95Amount = currentEquity * Math.abs(var95Hourly);

      // Maximum Drawdown
      let peak = snapshots[0].totalEquity;
      let maxDD = 0;

      for (const snapshot of snapshots) {
        const equity = snapshot.totalEquity;
        if (equity > peak) {
          peak = equity;
        }
        const drawdown = (peak - equity) / peak;
        if (drawdown > maxDD) {
          maxDD = drawdown;
        }
      }

      // Simple beta calculation
      const marketReturn: number = 0.0008;
      const covariance =
        returns.reduce(
          (sum, r) => sum + (r - meanReturn) * (marketReturn - marketReturn),
          0,
        ) / returns.length;
      const marketVariance: number = 0.01;
      const beta = marketVariance === 0 ? 1 : covariance / marketVariance;

      setRiskMetrics({
        sharpeRatio: sharpe,
        volatility: annualizedVol,
        maxDrawdown: maxDD * 100,
        var95: var95Amount,
        beta: Math.abs(beta) < 0.01 ? 1 : beta,
      });
    },
    [],
  );

  const calculateCompetitionScore = useCallback(
  (
    totalReturn: number,
    sharpe: number,
    maxDrawdown: number,
    volatility: number,
    trades: any[], // ← CHANGED: Pass full trades array instead of totalTrades count
    allTimeUniqueSymbols: number,
    snapshots: PortfolioSnapshot[],
  ): CompetitionScore => {
    // RETURN SCORE: Asymmetric penalty for losses (losses hurt 3x more)
    // Range: -16.67% return = 0, 0% = 50, +16.67% = 100
    const returnScore =
      totalReturn >= 0
        ? Math.min(100, 50 + totalReturn * 3)
        : Math.max(0, 50 + totalReturn * 9); // 9 = 3x penalty multiplier

    // RISK SCORE: Sharpe ratio (70%) + drawdown management (30%)
    // Sharpe component: 0-70 points (3.0+ Sharpe = max 70)
    const sharpeScore = Math.min((Math.max(sharpe, 0) / 3.0) * 70, 70);

    // Drawdown component: 0-30 points (0% DD = 30, 50%+ DD = 0)
    const drawdownScore = Math.max(0, 30 - maxDrawdown * 0.6);

    const riskScore = Math.max(0, Math.min(100, sharpeScore + drawdownScore));

    // CONSISTENCY SCORE: Positive return ratio + volatility penalty (with recency weighting)
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const consistencyHalfLifeDays = 14; // 2-week half-life for consistency
    const consistencyHalfLifeMs = consistencyHalfLifeDays * oneDayMs;

    let weightedPositiveDays = 0;
    let totalWeight = 0;

    snapshots.forEach((snapshot) => {
      const snapshotTime = snapshot.timestamp.getTime();
      const ageMs = now - snapshotTime;
      
      // Exponential decay: recent days weighted more heavily
      const decayFactor = Math.exp(-ageMs / consistencyHalfLifeMs);
      
      totalWeight += decayFactor;
      
      if (snapshot.dailyReturn > 0) {
        weightedPositiveDays += decayFactor;
      }
    });

    // Weighted positive ratio - recent performance matters more
    const weightedPositiveRatio = totalWeight > 0 ? weightedPositiveDays / totalWeight : 0;

    // Volatility penalty: 30% annualized vol = full penalty (more realistic than 100%)
    const volatilityPenalty = Math.min(volatility / 30, 1.0);

    const consistencyScore = Math.max(
      0,
      Math.min(100, weightedPositiveRatio * 60 + (1 - volatilityPenalty) * 40),
    );

    // ACTIVITY SCORE: Time-decayed trades + diversification
    // consts now & oneDayMs are both in the same place so no point duplicating
    const halfLifeDays = 7; // Activity "half-life" of 7 days
    const halfLifeMs = halfLifeDays * oneDayMs;

    let weightedTradeCount = 0;
    let recentTradeCount = 0;

    // Calculate weighted trade count with exponential decay
    trades.forEach((trade: any) => {
      const tradeTime = new Date(trade.placed_at ?? trade.filled_at ?? now).getTime();
      const ageMs = now - tradeTime;
      
      // Exponential decay: weight = e^(-age / halfLife)
      // After 7 days, a trade counts for ~50% of its original value
      // After 14 days, ~25%, after 21 days, ~12.5%, etc.
      const decayFactor = Math.exp(-ageMs / halfLifeMs);
      weightedTradeCount += decayFactor;
      
      // Count recent trades (last 7 days)
      if (ageMs < (7 * oneDayMs)) {
        recentTradeCount++;
      }
    });

    // Recent activity component: 10+ trades in last 7 days = max 30 points
    const recentTradeScore = Math.min(recentTradeCount / 10, 1.0) * 30;

    // Cumulative weighted component: 50 weighted trades = max 20 points
    const cumulativeTradeScore = Math.min(weightedTradeCount / 50, 1.0) * 20;

    // Diversification: 15+ unique symbols EVER traded = max 50 points
    const diversificationScore = Math.min(allTimeUniqueSymbols / 15, 1.0) * 50;

    const activityScore = recentTradeScore + cumulativeTradeScore + diversificationScore;

    // TOTAL SCORE: Returns weighted at 50%
    const totalScore =
      returnScore * 0.5 +
      riskScore * 0.25 +
      consistencyScore * 0.15 +
      activityScore * 0.1;

    return {
      returnScore: Math.round(returnScore),
      riskScore: Math.round(riskScore),
      consistencyScore: Math.round(consistencyScore),
      activityScore: Math.round(activityScore),
      totalScore: Math.round(totalScore),
    };
  },
  [],
  );

  // Sync portfolio to database and save HOURLY snapshot
  const syncPortfolioToDatabase = useCallback(
    async (
      userId: string,
      totalEquity: number,
      realizedPnL: number,
      initCapital: number,
      cash_balance: number,
    ) => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({
            total_equity: totalEquity,
            realized_pnl: realizedPnL,
            cash_balance: cashBalance,
          })
          .eq("id", userId);

        if (error) {
          console.error("❌ Failed to sync portfolio to DB:", error);
        } else {
          console.log(
            "✅ Portfolio synced to DB - Total Equity:",
            totalEquity,
            "Realized P&L:",
            realizedPnL,
          );
        }

        // Check for snapshot in the last hour (not just today)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentSnapshot } = await supabase
          .from("portfolio_snapshots")
          .select("id, timestamp")
          .eq("profile_id", userId)
          .gte("timestamp", oneHourAgo)
          .order("timestamp", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!recentSnapshot) {
          // Get most recent snapshot to calculate return
          const { data: lastSnapshot } = await supabase
            .from("portfolio_snapshots")
            .select("total_equity")
            .eq("profile_id", userId)
            .order("timestamp", { ascending: false })
            .limit(1)
            .maybeSingle();

          const previousEquity = lastSnapshot?.total_equity ?? initCapital;
          const periodReturn =
            previousEquity > 0
              ? (totalEquity - previousEquity) / previousEquity
              : 0;

          await supabase.from("portfolio_snapshots").insert({
            profile_id: userId,
            timestamp: new Date().toISOString(),
            total_equity: totalEquity,
            cash_balance: cashBalance,
            total_pnl: realizedPnL,
            daily_return: periodReturn,
          });

          console.log("✅ Hourly portfolio snapshot saved");
        } else {
          console.log(
            "⏭️ Snapshot already exists within the last hour, skipping",
          );
        }
      } catch (err) {
        console.error("❌ Error syncing portfolio:", err);
      }
    },
    [cashBalance],
  );

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

        // Fetch historical snapshots for risk calculations
        try {
          const { data: snapshotsData } = await supabase
            .from("portfolio_snapshots")
            .select("*")
            .eq("profile_id", userId)
            .order("timestamp", { ascending: true })
            .limit(2000);

          if (snapshotsData && snapshotsData.length > 0) {
            portfolioSnapshotsRef.current = snapshotsData.map((s: any) => ({
              timestamp: new Date(s.timestamp),
              totalEquity: Number(s.total_equity),
              dailyReturn: Number(s.daily_return ?? 0),
            }));
            console.log(
              `📊 Loaded ${portfolioSnapshotsRef.current.length} historical snapshots`,
            );

            // Extract P&L data for chart
            const pnlChartData = snapshotsData.map((s: any) => ({
              date: new Date(s.timestamp).toISOString().slice(0, 10),
              pnl: Number(s.total_pnl ?? 0),
            }));

            // Add starting point at 0 if data exists
            if (pnlChartData.length > 0) {
              const firstDate = new Date(snapshotsData[0].timestamp);
              firstDate.setHours(firstDate.getHours() - 1);
              pnlChartData.unshift({
                date: firstDate.toISOString().slice(0, 10),
                pnl: 0,
              });
            }

            setRealizedPnLData(pnlChartData);
          }
        } catch (err) {
          console.warn(
            "Could not fetch portfolio snapshots, risk metrics will be limited",
          );
        }

        const { data: tradesData, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId)
          .order("placed_at", { ascending: true });

        if (fetchError) throw fetchError;
        const trades = tradesData ?? [];

        // Extract 10 most recent trades for display
        const sortedTrades = [...trades].sort(
          (a, b) => new Date(b.placed_at ?? 0).getTime() - new Date(a.placed_at ?? 0).getTime()
        );
        setRecentTrades(sortedTrades.slice(0, 10));

        const symbolNameMap = new Map<string, string>();
        const positionsMap = new Map<string, any>();

        let totalCostBasis = 0;
        let totalProceeds = 0;

        // Single pass through trades to build positions
        trades.forEach((trade: any) => {
          const symbol = (trade.symbol ?? "").toUpperCase().trim();
          const side = (trade.side ?? "buy").toLowerCase();
          const quantity = Number(trade.quantity ?? 0);
          const price = Number(trade.price ?? 0);
          const notional = Number(trade.notional ?? quantity * price);

          // Track symbol names
          if (trade.name) {
            symbolNameMap.set(symbol, trade.name);
          }

          // Calculate cash flow
          if (side === "buy") {
            totalCostBasis += notional;
          } else if (side === "sell") {
            totalProceeds += notional;
          }

          // Initialize position if needed
          if (!positionsMap.has(symbol)) {
            positionsMap.set(symbol, {
              symbol,
              quantity: 0,
              costBasis: 0,
            });
          }

          const position = positionsMap.get(symbol)!;
          const oldQuantity = position.quantity;
          const oldCostBasis = position.costBasis;

          if (side === "buy") {
            // Buying shares
            if (oldQuantity >= 0) {
              // Adding to long or opening long
              position.quantity += quantity;
              position.costBasis += notional;
            } else {
              // Covering a short
              position.quantity += quantity;
              
              if (position.quantity === 0) {
                // Fully covered short
                position.costBasis = 0;
              } else if (position.quantity > 0) {
                // Covered short and went long
                position.costBasis = position.quantity * price;
              } else {
                // Still short, reduce cost basis proportionally
                const coverRatio = position.quantity / oldQuantity;
                position.costBasis = oldCostBasis * coverRatio;
              }
            }
          } else if (side === "sell") {
            // Selling shares
            if (oldQuantity > 0) {
              // Reducing or closing long
              position.quantity -= quantity;
              
              if (position.quantity === 0) {
                // Fully closed long
                position.costBasis = 0;
              } else if (position.quantity > 0) {
                // Reduced long, adjust cost basis proportionally
                const avgCost = oldCostBasis / oldQuantity;
                position.costBasis = position.quantity * avgCost;
              } else {
                // Went from long to short
                position.costBasis = Math.abs(position.quantity) * price;
              }
            } else {
              // Opening or adding to short
              position.quantity -= quantity;
              
              if (oldQuantity === 0) {
                // Opening new short position
                position.costBasis = Math.abs(position.quantity) * price;
              } else {
                // Adding to existing short (weighted average)
                const oldShortQty = Math.abs(oldQuantity);
                const newShortQty = quantity;
                const totalShortQty = Math.abs(position.quantity);
                const oldAvgPrice = oldShortQty > 0 ? oldCostBasis / oldShortQty : 0;
                const weightedAvgPrice = 
                  ((oldShortQty * oldAvgPrice) + (newShortQty * price)) / totalShortQty;
                position.costBasis = totalShortQty * weightedAvgPrice;
              }
            }
          }
        });

        const calculatedCashBalance = initialCapital - totalCostBasis + totalProceeds;
        setEquityCurveData(calculateEquityCurve(trades, initialCapital));

        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => Math.abs(pos.quantity) > 0.0001,
        );

        setInitialCapital(initialCapital);
        setCashBalance(calculatedCashBalance);

        // Fetch watchlist
        const { data: watchlistData } = await supabase
          .from("watchlist")
          .select("symbol")
          .eq("profile_id", userId);

        const watchlistSymbols = watchlistData?.map((item) => item.symbol) || [];
        setWatchlist(watchlistSymbols);

        // Combine position symbols + watchlist symbols
        const positionSymbols = aggregatedPositions.map((p) => p.symbol);
        const symbols = [...new Set([...positionSymbols, ...watchlistSymbols])];
        console.log(
          `📊 Fetching prices for ${positionSymbols.length} positions + ${watchlistSymbols.length} watchlist stocks`,
        );

        const detailedPositions: Position[] = aggregatedPositions.map((pos) => {
          const entryPrice =
            pos.quantity !== 0 ? pos.costBasis / Math.abs(pos.quantity) : 0;
          const lastKnownPrice = lastKnownPricesRef.current.get(pos.symbol);
          const currentPrice =
            lastKnownPrice && lastKnownPrice > 0 ? lastKnownPrice : entryPrice;
          const priceStale = !lastKnownPrice || lastKnownPrice === 0;
          const marketValue = pos.quantity * currentPrice;

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

        // Calculate equity (shorts are already negative in marketValue)
        let totalMarketValue = 0;
        detailedPositions.forEach((pos) => {
          totalMarketValue += pos.marketValue;
        });

        const totalEquityCalculated = calculatedCashBalance + totalMarketValue;
        const totalPnLCalculated = totalEquityCalculated - initialCapital;
        const totalReturn =
          initialCapital === 0 ? 0 : (totalPnLCalculated / initialCapital) * 100;

        setSummary({
          totalValue: totalEquityCalculated,
          totalPnL: totalPnLCalculated,
          totalPnLPercent: totalReturn,
          cashBalance: calculatedCashBalance,
          initialCapital,
          positionCount: detailedPositions.length,
        });

        calculateRiskMetrics(
          portfolioSnapshotsRef.current,
          totalEquityCalculated,
          initialCapital,
        );

        const buyTrades = trades.filter(
          (t: any) => (t.side ?? "buy").toLowerCase() === "buy",
        ).length;
        const sellTrades = trades.filter(
          (t: any) => (t.side ?? "sell").toLowerCase() === "sell",
        ).length;
        const totalVolume = trades.reduce(
          (sum: number, t: any) => sum + Math.abs(Number(t.quantity ?? 0)),
          0,
        );
        const totalNotional = trades.reduce(
          (sum: number, t: any) =>
            sum +
            Number(t.notional ?? Number(t.quantity ?? 0) * Number(t.price ?? 0)),
          0,
        );
        const averageTradeSize =
          trades.length > 0 ? totalNotional / trades.length : 0;

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

            // Calculate allocation data (only positive values for pie chart)
            const allocation = aggregatedPositions
              .map((pos) => ({
                symbol: pos.symbol,
                value: Math.abs(pos.quantity) * (prices.get(pos.symbol) ?? 0),
              }))
              .filter((a) => a.value > 0);
            setAllocationData(allocation);

            const updatedPositions = detailedPositions.map((pos) => {
              const freshPrice = prices.get(pos.symbol);
              if (freshPrice && freshPrice > 0) {
                return {
                  ...pos,
                  currentPrice: freshPrice,
                  marketValue: pos.quantity * freshPrice,
                  priceStale: false,
                };
              }
              return pos;
            });

            setPositions(updatedPositions);

            let updatedTotalMarketValue = 0;
            updatedPositions.forEach((pos) => {
              updatedTotalMarketValue += pos.marketValue;
            });

            const updatedTotalEquity = calculatedCashBalance + updatedTotalMarketValue;
            const updatedTotalPnLCalc = updatedTotalEquity - initialCapital;
            const updatedTotalReturn =
              initialCapital === 0 ? 0 : (updatedTotalPnLCalc / initialCapital) * 100;

            setSummary({
              totalValue: updatedTotalEquity,
              totalPnL: updatedTotalPnLCalc,
              totalPnLPercent: updatedTotalReturn,
              cashBalance: calculatedCashBalance,
              initialCapital,
              positionCount: updatedPositions.length,
            });

            calculateRiskMetrics(
              portfolioSnapshotsRef.current,
              updatedTotalEquity,
              initialCapital,
            );
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
        setError(
          err?.message ?? "An error occurred while fetching dashboard data",
        );
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
      hasUpdatedScoresRef.current = false;
    };
  }, [
    session?.user?.id,
    authLoading,
    fetchPrices,
    calculateRiskMetrics,
    calculateEquityCurve,
    calculateDailyPnL,
  ]);

  useEffect(() => {
    if (positions.length === 0 || priceMap.size === 0) return;

    const updatedPositions = positions.map((pos) => {
      const freshPrice = priceMap.get(pos.symbol);
      if (freshPrice && freshPrice > 0 && freshPrice !== pos.currentPrice) {
        return {
          ...pos,
          currentPrice: freshPrice,
          marketValue: pos.quantity * freshPrice,
          priceStale: false,
        };
      }
      return pos;
    });

    const hasChanges = updatedPositions.some(
      (pos, idx) => pos.currentPrice !== positions[idx].currentPrice,
    );

    if (hasChanges) {
      setPositions(updatedPositions);

      const allocation = updatedPositions
        .map((pos) => ({
          symbol: pos.symbol,
          value: pos.marketValue,
        }))
        .filter((a) => a.value > 0);
      setAllocationData(allocation);

      let totalLongValue = 0;
      let totalShortValue = 0;
      updatedPositions.forEach((pos) => {
        if (pos.positionType === "LONG") {
          totalLongValue += pos.marketValue;
        } else {
          totalShortValue += pos.marketValue;
        }
      });
      const totalMarketValue = totalLongValue + totalShortValue;

      const totalEquity = cashBalance + totalLongValue + totalShortValue;
      const totalPnL = totalEquity - initialCapital;
      const totalReturn =
        initialCapital === 0 ? 0 : (totalPnL / initialCapital) * 100;

      setSummary((prev) => ({
        ...prev,
        totalValue: totalEquity,
        totalPnL: totalPnL,
        totalPnLPercent: totalReturn,
        positionCount: updatedPositions.length,
      }));

      calculateRiskMetrics(
        portfolioSnapshotsRef.current,
        totalEquity,
        initialCapital,
      );
    }
  }, [priceMap, cashBalance, initialCapital, calculateRiskMetrics]);

  useEffect(() => {
    if (summary.totalValue === 0 || loading) return;

    const fetchTradesForScore = async () => {
      const userId = session?.user?.id;
      if (!userId) return;

      const { data: tradesData } = await supabase
        .from("trades")
        .select("placed_at, filled_at, symbol")
        .eq("profile_id", userId)
        .order("placed_at", { ascending: true });

      const trades = tradesData ?? [];
      
      // Calculate unique symbols traded
      const uniqueSymbols = new Set(
        trades.map((t: any) => (t.symbol ?? "").toUpperCase().trim())
      ).size;

      const score = calculateCompetitionScore(
        summary.totalPnLPercent,
        riskMetrics.sharpeRatio,
        riskMetrics.maxDrawdown,
        riskMetrics.volatility,
        trades, // ← Pass trades array
        uniqueSymbols, // ← Pass unique symbols count
        portfolioSnapshotsRef.current,
      );

      setCompetitionScore(score);
    };

    fetchTradesForScore();
  }, [
    summary.totalPnLPercent,
    summary.totalValue,
    riskMetrics,
    tradingStats.totalTrades, // Triggers recalc when new trades happen
    loading,
    calculateCompetitionScore,
    session?.user?.id,
  ]);

  // Fetch watchlist early
  useEffect(() => {
    const userId = session?.user?.id;
    if (userId && !loading) {
      const watchlistSymbols = watchlist;
    }
  }, [session?.user?.id, watchlist, loading]);

  // Competition scoring useEffect - ONLY update if scores actually changed OR stale
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || loading) return;

    // Skip if we've already updated this session and values haven't changed
    if (hasUpdatedScoresRef.current) {
      console.log("⏭️ Scores already synced this session, skipping");
      return;
    }

    const timeoutId = setTimeout(async () => {
      // Sync portfolio first
      await syncPortfolioToDatabase(
        userId,
        summary.totalValue,
        summary.totalPnL,
        initialCapital,
        cashBalance,
      );

      // Fetch CURRENT scores from database
      const { data: currentScores } = await supabase
        .from("profiles")
        .select(
          "competition_score, return_score, risk_score, consistency_score, activity_score, score_last_updated",
        )
        .eq("id", userId)
        .single();

      // Calculate current scores
      const currentDbScore = currentScores?.competition_score || 0;
      const calculatedScore = competitionScore.totalScore;

      // Check if scores are stale (older than 12 hours)
      const lastUpdated = currentScores?.score_last_updated
        ? new Date(currentScores.score_last_updated).getTime()
        : 0;
      const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
      const scoresAreStale = lastUpdated < twelveHoursAgo;

      // Only update if scores have changed OR if this is first score OR if stale
      const scoreDiff = Math.abs(currentDbScore - calculatedScore);
      const isFirstScore = currentDbScore === 0 && !currentScores?.return_score;

      if (scoreDiff > 1 || isFirstScore || scoresAreStale) {
        const reason = isFirstScore
          ? "First score write"
          : scoresAreStale
            ? `Scores stale (>${((Date.now() - lastUpdated) / (60 * 60 * 1000)).toFixed(1)}hrs old), refreshing`
            : `Score changed by ${scoreDiff.toFixed(1)} points`;

        console.log(`🔄 ${reason}, updating database`);

        try {
          await supabase
            .from("profiles")
            .update({
              competition_score: competitionScore.totalScore,
              return_score: competitionScore.returnScore,
              risk_score: competitionScore.riskScore,
              consistency_score: competitionScore.consistencyScore,
              activity_score: competitionScore.activityScore,
              score_last_updated: new Date().toISOString(),
            })
            .eq("id", userId);

          console.log("✅ Competition scores updated");
          hasUpdatedScoresRef.current = true;
        } catch (err) {
          console.error("❌ Failed to update scores:", err);
        }
      } else {
        console.log(
          `⏭️ Score difference (${scoreDiff.toFixed(1)}) too small and not stale, skipping update`,
        );
        hasUpdatedScoresRef.current = true;
      }
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [
    summary.totalValue,
    summary.totalPnL,
    session?.user?.id,
    loading,
    syncPortfolioToDatabase,
    initialCapital,
    cashBalance,
    competitionScore.totalScore,
    competitionScore.returnScore,
    competitionScore.riskScore,
    competitionScore.consistencyScore,
    competitionScore.activityScore,
  ]);

  // Reset the flag when trade count changes (actual new activity)
  useEffect(() => {
    hasUpdatedScoresRef.current = false;
  }, [tradingStats.totalTrades]);

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div>
          <h1>{societyName} Portfolio Dashboard</h1>
          <p className="subtitle">Here's an overview of your trading account</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Log Out
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading dashboard...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          {/* SECTION 1: Portfolio Summary (MOST CRITICAL) */}
          <div className="stats-grid">
            <div
              className={`stat-card highlight ${summary.totalPnLPercent >= 0 ? "positive" : "negative"}`}
            >
              <div className="stat-label">Portfolio Value</div>
              <div className="stat-value">
                {formatCurrency(summary.totalValue)}
              </div>
              <div
                className={`stat-change ${summary.totalPnLPercent >= 0 ? "positive" : "negative"}`}
              >
                {formatPercent(summary.totalPnLPercent)}
              </div>
            </div>

            <div
              className={`stat-card ${summary.totalPnL >= 0 ? "positive" : "negative"}`}
            >
              <div className="stat-label">Total P&L</div>
              <div className="stat-value">
                {formatCurrency(summary.totalPnL)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Cash Balance</div>
              <div className="stat-value">
                {formatCurrency(summary.cashBalance)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label">Active Positions</div>
              <div className="stat-value">{summary.positionCount}</div>
            </div>
          </div>

          {/* SECTION 2: Active Positions (CRITICAL FOR TRADERS) */}
          {positions.length > 0 ? (
            <div className="positions-section">
              <h2>Active Positions</h2>
              <div className="table-container">
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Name</th>
                      <th>Position</th>
                      <th>Quantity</th>
                      <th>Entry Price</th>
                      <th>Current Price</th>
                      <th>Market Value</th>
                      <th>P&L ($)</th>
                      <th>P&L (%)</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((position, idx) => {
                      const currentPrice =
                        priceMap.get(position.symbol.toUpperCase().trim()) ??
                        position.currentPrice;
                      const pnl = calculatePnLForDisplay(position);
                      const pnlPercent = calculatePnLPercent(position);

                      return (
                        <tr key={idx}>
                          <td>
                            <strong>{position.symbol}</strong>
                          </td>
                          <td>{position.name}</td>
                          <td>
                            <span
                              className={`position-badge ${position.positionType.toLowerCase()}`}
                            >
                              {position.positionType}
                            </span>
                          </td>
                          <td>{Math.abs(position.quantity).toFixed(2)}</td>
                          <td>{formatCurrency(position.entryPrice ?? 0)}</td>
                          <td>
                            {formatCurrency(currentPrice)}
                            {position.priceStale && (
                              <span
                                className="stale-indicator"
                                title="Price may be stale"
                              >
                                ⚠
                              </span>
                            )}
                          </td>
                          <td>
                            {formatCurrency(
                              Math.abs(position.quantity) * currentPrice,
                            )}
                          </td>
                          <td
                            className={`pnl-cell ${pnl >= 0 ? "positive" : "negative"}`}
                          >
                            {formatCurrency(pnl)}
                          </td>
                          <td
                            className={`pnl-cell ${pnlPercent >= 0 ? "positive" : "negative"}`}
                          >
                            {formatPercent(pnlPercent)}
                          </td>
                          <td>
                            <button
                              className="close-position-button"
                              onClick={() => handleClosePosition(position)}
                              title={`Close ${position.symbol} position`}
                            >
                              Close
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {positions.some((p) => p.priceStale) && (
                <div className="stale-price-warning">
                  ⚠ = Price may be stale or unavailable
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <h2>Active Positions</h2>
              <p>
                No active positions. Start trading to see your portfolio here.
              </p>
            </div>
          )}

          {/* SECTION 3: Performance Charts (IMPORTANT FOR ANALYSIS) */}
          <section className="dashboard-charts">
            <div className="chart-container chart-full-width">
              <h2>Realised P&L Performance</h2>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart
                  data={realizedPnLData}
                  margin={{ top: 12, right: 24, left: 60, bottom: 40 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255, 255, 255, 0.1)"
                  />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255, 255, 255, 0.5)"
                    tick={{
                      fill: "rgba(255, 255, 255, 0.7)",
                      fontSize: 11,
                    }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      });
                    }}
                    interval={Math.floor(realizedPnLData.length / 6)}
                    minTickGap={80}
                  />
                  <YAxis
                    stroke="rgba(255, 255, 255, 0.5)"
                    tick={{
                      fill: "rgba(255, 255, 255, 0.7)",
                      fontSize: 12,
                    }}
                    width={50}
                    tickFormatter={(v) => formatAxisCurrency(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(20, 25, 35, 0.95)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    labelFormatter={(value) => {
                      const date = new Date(String(value));
                      return date.toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      });
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "Baseline") {
                        return [formatCurrency(0), "Baseline"];
                      }
                      return [formatCurrency(Number(value)), "Realised P&L"];
                    }}
                  />
                  {/* Reference line at 0 P&L */}
                  <Line
                    type="monotone"
                    dataKey={() => 0}
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Baseline"
                  />
                  {/* Realized P&L line */}
                  <Line
                    type="monotone"
                    dataKey="pnl"
                    stroke="var(--brand, #2e8cff)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    name="Realized P&L"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="chart-row">
              <div className="chart-container">
                <h2>News Feed</h2>
                <div className="chart-empty">Coming Soon!</div>
              </div>
              <div className="chart-container">
                <h2>Position Allocation</h2>
                {allocationData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="symbol"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        label={({
                          name,
                          percent,
                        }: {
                          name?: string;
                          percent?: number;
                        }) =>
                          `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                        }
                      >
                        {allocationData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              [
                                "#2e8cff",
                                "#22c55e",
                                "#eab308",
                                "#ef4444",
                                "#8b5cf6",
                                "#ec4899",
                                "#06b6d4",
                                "#f97316",
                              ][index % 8]
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(20, 25, 35, 0.95)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                        labelStyle={{ color: "#fff" }}
                        itemStyle={{ color: "#60a5fa" }}
                        formatter={(value: number) => [
                          formatCurrency(value),
                          "Value",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="chart-empty">
                    No positions with market value to display
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 5: Risk & Performance Metrics (ANALYTICAL) */}
          <div className="risk-metrics-section">
            <h2>Risk & Performance Metrics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Sharpe Ratio</div>
                <div className="stat-value">
                  {riskMetrics.sharpeRatio.toFixed(2)}
                </div>
                <div className="stat-description">
                  {riskMetrics.sharpeRatio > 1
                    ? "Excellent"
                    : riskMetrics.sharpeRatio > 0
                      ? "Good"
                      : "Poor"}{" "}
                  risk-adjusted return
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Portfolio Volatility</div>
                <div className="stat-value">
                  {riskMetrics.volatility.toFixed(2)}%
                </div>
                <div className="stat-description">
                  Annualized standard deviation
                </div>
              </div>

              <div className="stat-card">
                <div
                  className={`stat-label ${riskMetrics.maxDrawdown > 20 ? "warning" : ""}`}
                >
                  Max Drawdown
                </div>
                <div
                  className={`stat-value ${riskMetrics.maxDrawdown > 20 ? "negative" : ""}`}
                >
                  {riskMetrics.maxDrawdown.toFixed(2)}%
                </div>
                <div className="stat-description">
                  Worst peak-to-trough decline
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-label">VaR (95%)</div>
                <div className="stat-value">
                  {formatCurrency(riskMetrics.var95)}
                </div>
                <div className="stat-description">
                  Hourly risk at 95% confidence
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 6: Competition Score (COMPARATIVE/RANKING) */}
          <div className="competition-score-section">
            <h2>Competition Score</h2>
            <div className="stats-grid">
              <div className="stat-card highlight">
                <div className="stat-label">Total Competition Score</div>
                <div className="stat-value">
                  {competitionScore.totalScore}/100
                </div>
                <div className="stat-description">
                  Your overall competition ranking score
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Return Score (50%)</div>
                <div className="stat-value">{competitionScore.returnScore}</div>
                <div className="stat-description">
                  Based on total return vs initial capital
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Risk Score (25%)</div>
                <div className="stat-value">{competitionScore.riskScore}</div>
                <div className="stat-description">
                  Sharpe ratio and drawdown management
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Consistency Score (15%)</div>
                <div className="stat-value">
                  {competitionScore.consistencyScore}
                </div>
                <div className="stat-description">
                  Steady growth and low volatility
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Activity Score (10%)</div>
                <div className="stat-value">
                  {competitionScore.activityScore}
                </div>
                <div className="stat-description">
                  Trading frequency and diversification
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 7: Watchlist (SUPPLEMENTARY) */}
          <div className="watchlist-section">
            <h2>Watchlist {watchlist.length > 0 && `(${watchlist.length})`}</h2>
            {watchlist.length > 0 ? (
              <div className="watchlist-grid">
                {watchlist.map((symbol) => {
                  const price = priceMap.get(symbol.toUpperCase()) || 0;
                  const handleRemove = () => removeFromWatchlist(symbol);
                  return (
                    <div key={symbol} className="watchlist-item">
                      <div className="watchlist-item-header">
                        <div className="watchlist-symbol">{symbol}</div>
                        <button
                          className="watchlist-remove-btn"
                          onClick={handleRemove}
                          title="Remove from watchlist"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="watchlist-price">
                        {formatCurrency(price)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="watchlist-empty">
                <p>Your watchlist is empty. Add stocks to track them here.</p>
              </div>
            )}
          </div>

          {/* Recent Trades Section */}
          <div className="trading-stats-section">
            <h2>Recent Trades</h2>
            
            {recentTrades.length > 0 ? (
              <div className="table-container">
                <table className="positions-table">
                  <thead>
                    <tr>
                      <th>Date/Time</th>
                      <th>Symbol</th>
                      <th>Side</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Total Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTrades.map((trade, idx) => {
                      const side = (trade.side ?? "buy").toLowerCase();
                      const notional = Number(
                        trade.notional ?? Number(trade.quantity ?? 0) * Number(trade.price ?? 0)
                      );
                      const tradeDate = new Date(trade.placed_at ?? trade.filled_at ?? new Date());
                      
                      return (
                        <tr key={`${trade.id}-${idx}`}>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              <span style={{ fontWeight: 600 }}>
                                {tradeDate.toLocaleDateString("en-GB", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                              <span style={{ fontSize: "0.85rem", color: "#9aa3b2" }}>
                                {tradeDate.toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </td>
                          <td>
                            <strong style={{ color: "#FFFFFF" }}>{trade.symbol}</strong>
                          </td>
                          <td>
                            <span className={`position-badge ${side === "buy" ? "long" : "short"}`}>
                              {side}
                            </span>
                          </td>
                          <td>
                            {Number(trade.quantity ?? 0).toLocaleString("en-US", {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td>{formatCurrency(Number(trade.price ?? 0))}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(notional)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <p>No trades yet. Start trading to see your history here.</p>
              </div>
            )}
          </div>

          {/* SECTION 4: Trading Statistics (OPERATIONAL DATA) */}
          <div className="trading-stats-section">
            <h2>Trading Statistics</h2>
            <table className="stats-table">
              <tbody>
                <tr>
                  <td>Total Trades</td>
                  <td>
                    <strong>{tradingStats.totalTrades}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Buy Orders</td>
                  <td>{tradingStats.buyTrades}</td>
                </tr>
                <tr>
                  <td>Sell Orders</td>
                  <td>{tradingStats.sellTrades}</td>
                </tr>
                <tr>
                  <td>Total Volume</td>
                  <td>{tradingStats.totalVolume.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>Total Notional</td>
                  <td>{formatCurrency(tradingStats.totalNotional)}</td>
                </tr>
                <tr>
                  <td>Avg Trade Size</td>
                  <td>{formatCurrency(tradingStats.averageTradeSize)}</td>
                </tr>
                <tr>
                  <td>Most Traded Stock</td>
                  <td>
                    {tradingStats.mostTradedStock} (
                    {tradingStats.mostTradedCount})
                  </td>
                </tr>
                <tr>
                  <td>Trades Today</td>
                  <td>{tradingStats.tradesToday}</td>
                </tr>
                <tr>
                  <td>Trades This Week</td>
                  <td>{tradingStats.tradesThisWeek}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION 8: Quick Actions (UTILITY) */}
          <div className="quick-actions">
            <h2>Quick Actions</h2>
            <div className="actions-grid">
              <Link to="/stocks" className="action-card">
                <h3>Browse Stocks</h3>
                <p>Explore and trade stocks</p>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
