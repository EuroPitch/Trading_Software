import React, { useState, useEffect } from "react";
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

type Position = {
  symbol: string;
  name?: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  positionType: string;
  entryPrice: number;
};

export default function Dashboard() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalPnL: 0,
    totalPnLPercent: 0,
    cashBalance: 0,
    initialCapital: 100000,
    positionCount: 0,
  });
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const calculatePnL = (position: Position) => {
    const marketValue = position.marketValue ?? 0;
    const costBasis = Math.abs(position.costBasis ?? 0);

    if (position.quantity > 0) {
      return marketValue - costBasis;
    } else {
      return costBasis - marketValue;
    }
  };

  const calculatePnLPercent = (position: Position) => {
    const pnl = calculatePnL(position);
    const costBasis = Math.abs(position.costBasis ?? 0);
    if (costBasis === 0) return 0;
    return (pnl / costBasis) * 100;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      setError(null);
      try {
        const userId = session?.user?.id;
        if (!userId) {
          setLoading(false);
          return;
        }

        // Fetch initial capital from profiles table
        let initialCapital = 100000;
        try {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("initial_capital")
            .eq("id", userId)
            .single();

          if (profileData?.initial_capital) {
            initialCapital = Number(profileData.initial_capital);
          }
        } catch (err) {
          console.warn("Could not fetch initial capital, using default €100k");
        }

        // Fetch all trades for this user
        const { data: tradesData, error: fetchError } = await supabase
          .from("trades")
          .select("*")
          .eq("profile_id", userId)
          .order("placed_at", { ascending: true });

        if (fetchError) {
          throw fetchError;
        }

        console.log("Fetched trades:", tradesData?.length || 0);

        // Aggregate trades with position netting - FIXED LOGIC
        const positionsMap = new Map();
        const symbolNameMap = new Map();

        (tradesData ?? []).forEach((trade: any) => {
          const symbol = trade.symbol ?? "";
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
            });
          }

          const position = positionsMap.get(key)!;
          
          // FIXED: Proper position netting logic
          if (side === "buy") {
            position.quantity += quantity;
            position.costBasis += notional;
          } else if (side === "sell") {
            const oldQuantity = position.quantity;
            const oldCostBasis = position.costBasis;
            
            position.quantity -= quantity;
            
            // If we had a long position and still do (or went flat)
            if (oldQuantity > 0 && position.quantity >= 0) {
              // Proportionally reduce cost basis
              if (oldQuantity > 0) {
                const avgCost = oldCostBasis / oldQuantity;
                position.costBasis = position.quantity * avgCost;
              } else {
                position.costBasis = 0;
              }
            }
            // If we went from long to short
            else if (oldQuantity > 0 && position.quantity < 0) {
              // Cost basis is now the short position value
              position.costBasis = Math.abs(position.quantity) * price;
            }
            // If we were already short, add to the short
            else if (oldQuantity <= 0) {
              position.costBasis += notional;
            }
          }
        });

        console.log("Positions map before filter:", Array.from(positionsMap.values()));

        // Filter out flat positions
        const aggregatedPositions = Array.from(positionsMap.values()).filter(
          (pos) => Math.abs(pos.quantity) > 0.0001 // Use small epsilon for floating point
        );

        console.log("Aggregated positions after filter:", aggregatedPositions);

        // Get unique symbols to fetch prices for
        const symbols = [...new Set(aggregatedPositions.map((p) => p.symbol))];

        // Fetch current prices from API
        let priceMap = new Map();
        if (symbols.length > 0) {
          try {
            const symbolParams = symbols.map((s) => `symbols=${s}`).join("&");
            const priceResponse = await fetch(
              `https://europitch-trading-prices.vercel.app/equities/quotes?${symbolParams}&chunk_size=50`
            );

            if (priceResponse.ok) {
              const priceData = await priceResponse.json();
              if (Array.isArray(priceData)) {
                priceData.forEach((item: any) => {
                  priceMap.set(
                    item.symbol ?? item.ticker,
                    Number(
                      item.price ??
                        item.last ??
                        item.close ??
                        item.current ??
                        0
                    )
                  );
                });
              } else {
                Object.entries(priceData).forEach(([symbol, data]: [string, any]) => {
                  priceMap.set(
                    symbol,
                    Number(
                      data.price ??
                        data.last ??
                        data.close ??
                        data.current ??
                        0
                    )
                  );
                });
              }
            }
          } catch (priceError) {
            console.error("Failed to fetch prices:", priceError);
          }
        }

        // Build detailed positions array with all info
        const detailedPositions: Position[] = aggregatedPositions.map((pos) => {
          const priceFromMap = priceMap.get(pos.symbol);
          const currentPrice =
            priceFromMap ??
            (pos.quantity !== 0 ? Math.abs(pos.costBasis) / Math.abs(pos.quantity) : 0);
          const marketValue = Math.abs(pos.quantity) * currentPrice;
          const entryPrice =
            pos.quantity !== 0 ? Math.abs(pos.costBasis) / Math.abs(pos.quantity) : 0;

          return {
            symbol: pos.symbol,
            name: symbolNameMap.get(pos.symbol) || pos.symbol,
            quantity: pos.quantity,
            costBasis: pos.costBasis,
            currentPrice: currentPrice,
            marketValue: marketValue,
            entryPrice: entryPrice,
            positionType: pos.quantity > 0 ? "LONG" : "SHORT",
          };
        });

        console.log("Detailed positions:", detailedPositions);

        // Calculate portfolio values
        const computedEquityValue = detailedPositions.reduce((sum, pos) => {
          return sum + pos.marketValue;
        }, 0);

        const computedTotalCost = aggregatedPositions.reduce((sum, pos) => {
          return sum + Math.abs(pos.costBasis ?? 0);
        }, 0);

        const cashBalance = initialCapital - computedTotalCost;
        const totalPortfolioValue = computedEquityValue + cashBalance;

        const computedTotalPnL = detailedPositions.reduce((sum, pos) => {
          return sum + calculatePnL(pos);
        }, 0);

        const computedTotalPnLPercent =
          initialCapital === 0 ? 0 : (computedTotalPnL / initialCapital) * 100;

        setSummary({
          totalValue: totalPortfolioValue,
          totalPnL: computedTotalPnL,
          totalPnLPercent: computedTotalPnLPercent,
          cashBalance: cashBalance,
          initialCapital: initialCapital,
          positionCount: aggregatedPositions.length,
        });

        setPositions(detailedPositions);
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err?.message ?? err);
        setError(err?.message ?? "An error occurred while fetching dashboard data");
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) fetchDashboardData();
  }, [session, authLoading]);

  const userEmail = session?.user?.email || localStorage.getItem("userEmail") || "User";

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1>{userEmail.split("@")[0]} Portfolio Dashboard</h1>
          <p className="welcome-subtitle">Here's an overview of your trading account</p>
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

          {/* Positions Table Section */}
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
                      const pnl = calculatePnL(position);
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
                            {formatCurrency(position.currentPrice ?? 0)}
                          </td>
                          <td className="align-right">
                            {formatCurrency(position.marketValue ?? 0)}
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
            </div>
          ) : (
            <div className="positions-section">
              <h2 className="positions-title">Active Positions</h2>
              <p style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                No active positions. Start trading to see your portfolio here.
              </p>
            </div>
          )}

          <div className="dashboard-actions">
            <h2>Quick Actions</h2>
            <div className="action-cards">
              <Link to="/stocks" className="action-card">
                <div className="action-icon">📈</div>
                <h3>Browse Stocks</h3>
                <p>Explore and trade stocks</p>
              </Link>

              <div className="action-card" style={{ cursor: 'default' }}>
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