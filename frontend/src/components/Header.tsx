import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import logo from "../assets/EuroPitch_logo.png";
import { useAuth } from "../context/AuthContext";
import { useCompetitionScore } from "../context/CompetitionScoreContext";
import { AiFillStar } from "react-icons/ai";
import "./Header.css";
import { useWatchlist } from "../context/WatchlistContext";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScoreDropdown, setShowScoreDropdown] = useState(false);
  const [showWatchlistDropdown, setShowWatchlistDropdown] = useState(false);
  const [priceMap, setPriceMap] = useState<Map<string, number>>(new Map());
  
  const { session, loading } = useAuth();
  const { competitionScore } = useCompetitionScore();
  const { watchlist, removeFromWatchlist } = useWatchlist();

  const isAuthenticated = !!session && !loading;

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/stocks", label: "Stocks" },
  ];

  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return "#00ff88"; // Green
    if (score >= 60) return "#C9A961"; // Gold
    if (score >= 40) return "#FFA500"; // Orange
    return "#ff4757"; // Red
  };

  const totalScore = competitionScore.totalScore;
  const scoreColor = getScoreColor(totalScore);

  // Fetch prices for watchlist (same as Dashboard)
  useEffect(() => {
    if (watchlist.length === 0) return;

    const fetchPrices = async () => {
      try {
        const symbolParams = watchlist.map((s) => `symbols=${s}`).join("&");
        const priceResponse = await fetch(
          `https://trading-software.onrender.com/equities/quotes?${symbolParams}&chunk_size=50`,
          { signal: AbortSignal.timeout(10000) }
        );

        if (priceResponse.ok) {
          const priceData = await priceResponse.json();
          const newPriceMap = new Map<string, number>();

          if (priceData.data && typeof priceData.data === "object") {
            Object.entries(priceData.data).forEach(([symbol, stockData]: [string, any]) => {
              const price = Number(stockData?.price ?? 0);
              if (symbol && price > 0) {
                newPriceMap.set(symbol.toUpperCase().trim(), price);
              }
            });
          }

          setPriceMap(newPriceMap);
        }
      } catch (error) {
        console.error("Error fetching prices:", error);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 30000);
    return () => clearInterval(interval);
  }, [watchlist]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);

  return (
    <header className="header">
      <div className="nav-container">
        <NavLink to="/" className="brand">
          <img src={logo} alt="EuroPitch Logo" className="logo" />
          <span className="brand-text"></span>
        </NavLink>

        <button
          className={`menu-toggle ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${menuOpen ? "active" : ""}`}>
          {isAuthenticated &&
            navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        {isAuthenticated && (
          <div className="header-score-container">
            <div className="watchlist-container">
              <button
                className="watchlist-badge"
                onClick={() => setShowWatchlistDropdown(!showWatchlistDropdown)}
                title="Your Watchlist"
              >
                <AiFillStar className="watchlist-icon" />
                {watchlist.length > 0 && (
                  <span className="watchlist-count">{watchlist.length}</span>
                )}
              </button>

              {showWatchlistDropdown && (
                <div
                  className="score-dropdown-overlay"
                  onClick={() => setShowWatchlistDropdown(false)}
                >
                  <div
                    className="score-dropdown watchlist-dropdown"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="dropdown-header">
                      <h3>Your Watchlist</h3>
                    </div>

                    {watchlist.length === 0 ? (
                      <div className="dropdown-empty">
                        <p>No stocks in watchlist</p>
                        <NavLink
                          to="/stocks"
                          className="btn-browse"
                          onClick={() => setShowWatchlistDropdown(false)}
                        >
                          Browse Stocks
                        </NavLink>
                      </div>
                    ) : (
                      <div className="watchlist-items">
                        {watchlist.map((symbol) => {
                          const price = priceMap.get(symbol.toUpperCase()) || 0;
                          return (
                            <div key={symbol} className="watchlist-item">
                              <div className="watchlist-item-left">
                                <span className="symbol">{symbol}</span>
                                <button
                                  className="btn-remove"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeFromWatchlist(symbol);
                                  }}
                                  title="Remove from watchlist"
                                >
                                  ×
                                </button>
                              </div>
                              <span className="price">
                                {formatCurrency(price)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              className="competition-score-badge"
              onClick={() => setShowScoreDropdown(!showScoreDropdown)}
              title="Click to view detailed scores"
              style={{ borderColor: scoreColor }}
            >
              <div className="score-number" style={{ color: scoreColor }}>
                {totalScore}
              </div>
              <div className="score-label">Competition Score</div>
            </button>

            {showScoreDropdown && (
              <div
                className="score-dropdown-overlay"
                onClick={() => setShowScoreDropdown(false)}
              >
                <div
                  className="score-dropdown"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dropdown-item">
                    <span className="dropdown-label">Total Score</span>
                    <span 
                      className="dropdown-value total"
                      style={{ color: scoreColor }}
                    >
                      {totalScore}/100
                    </span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Return (50%)</span>
                    <span className="dropdown-value">
                      {competitionScore.returnScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Risk (25%)</span>
                    <span className="dropdown-value">
                      {competitionScore.riskScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Consistency (15%)</span>
                    <span className="dropdown-value">
                      {competitionScore.consistencyScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Activity (10%)</span>
                    <span className="dropdown-value">
                      {competitionScore.activityScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;