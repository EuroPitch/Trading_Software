import React, { useState, useEffect } from "react";
import "./StockDetailModal.css";
import StockOrderModal from "../StockOrderModal/StockOrderModal";
import { supabase } from "../../../supabaseClient"; // ADD THIS IMPORT

export default function StockDetailModal({ stock, onClose }: any) {
  const [activeTab, setActiveTab] = useState("valuation");
  const [isWatched, setIsWatched] = useState(false);

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
      case "percent":
        return `${value.toFixed(2)}%`;
      case "decimal":
        return value.toFixed(2);
      case "marketCap":
        if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        return `$${(value / 1e6).toFixed(2)}M`;
      default:
        return value;
    }
  };

  useEffect(() => {
    const checkWatchlist = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('watchlist')
        .select('id')
        .eq('profile_id', user.id)
        .eq('symbol', stock.symbol)
        .maybeSingle();

      setIsWatched(!!data);
    };

    checkWatchlist();
  }, [stock.symbol]);

  const tabs: any = {
    valuation: [
      { label: "Market Cap", value: stock.marketCap, format: "marketCap" },
      { label: "P/E Ratio", value: stock.peRatio, format: "decimal" },
      { label: "P/B Ratio", value: stock.pbRatio, format: "decimal" },
      { label: "PEG Ratio", value: stock.pegRatio, format: "decimal" },
      { label: "Dividend Yield", value: stock.dividendYield, format: "percent" },
      { label: "Beta", value: stock.beta, format: "decimal" },
    ],
    profitability: [
      { label: "ROE", value: stock.roe, format: "percent" },
      { label: "ROA", value: stock.roa, format: "percent" },
      { label: "Gross Margin", value: stock.grossMargin, format: "percent" },
      { label: "Operating Margin", value: stock.operatingMargin, format: "percent" },
      { label: "Net Margin", value: stock.netMargin, format: "percent" },
    ],
    growth: [
      { label: "Revenue Growth", value: stock.revenueGrowth, format: "percent" },
      { label: "Earnings Growth", value: stock.earningsGrowth, format: "percent" },
    ],
    technical: [
      { label: "Current Price", value: stock.price, format: "currency" },
      { label: "Change", value: stock.change, format: "currency", colored: true },
      { label: "Change %", value: stock.changePercent, format: "percent", colored: true },
      { label: "RSI (14)", value: stock.rsi, format: "decimal" },
      { label: "52W High", value: stock.fiftyTwoWeekHigh, format: "currency" },
      { label: "52W Low", value: stock.fiftyTwoWeekLow, format: "currency" },
      { label: "Volume", value: stock.volume, format: "number" },
      { label: "Avg Volume", value: stock.avgVolume, format: "number" },
    ],
    financial: [
      { label: "Debt to Equity", value: stock.debtToEquity, format: "decimal" },
      { label: "Current Ratio", value: stock.currentRatio, format: "decimal" },
      { label: "Quick Ratio", value: stock.quickRatio, format: "decimal" },
    ],
  };

  const toggleWatchlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please log in to use watchlist");
      return;
    }

    try {
      if (isWatched) {
        // Remove from watchlist
        await supabase
          .from('watchlist')
          .delete()
          .eq('profile_id', user.id)
          .eq('symbol', stock.symbol);
        setIsWatched(false);
      } else {
        // Add to watchlist
        await supabase
          .from('watchlist')
          .insert({
            profile_id: user.id,
            symbol: stock.symbol,
            name: stock.name || stock.symbol
          });
        setIsWatched(true);
      }
    } catch (error) {
      console.error('Error toggling watchlist:', error);
      alert('Failed to update watchlist');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{stock.symbol}</h2>
            <p className="modal-subtitle">{stock.name}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button 
              className={`watchlist-btn ${isWatched ? 'watched' : ''}`}
              onClick={toggleWatchlist}
              title={isWatched ? "Remove from watchlist" : "Add to watchlist"}
            >
              {isWatched ? '★' : '☆'}
            </button>
            <button className="btn-modal-close" onClick={onClose}>
              ×
            </button>
          </div>
        </div>

        <div className="stock-summary">
          <div className="summary-item">
            <span className="summary-label">Current Price</span>
            <span className="summary-value">
              {formatValue(stock.price, "currency")}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Change</span>
            <span
              className={`summary-value ${
                stock.change >= 0 ? "positive" : "negative"
              }`}
            >
              {formatValue(stock.change, "currency")}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Change %</span>
            <span
              className={`summary-value ${
                stock.changePercent >= 0 ? "positive" : "negative"
              }`}
            >
              {formatValue(stock.changePercent, "percent")}
            </span>
          </div>
        </div>

        <div className="modal-tabs">
          {Object.keys(tabs).map((tab) => (
            <button
              key={tab}
              className={`tab-button ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
          <button
            className={`tab-button ${activeTab === "trade" ? "active" : ""}`}
            onClick={() => setActiveTab("trade")}
          >
            Trade
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "trade" ? (
            <StockOrderModal stock={stock} />
          ) : (
            <div className="metrics-grid">
              {tabs[activeTab].map((metric: any, index: number) => (
                <div key={index} className="metric-item">
                  <span className="metric-label">{metric.label}</span>
                  <span
                    className={`metric-value ${
                      metric.colored
                        ? metric.value >= 0
                          ? "positive"
                          : "negative"
                        : ""
                    }`}
                  >
                    {formatValue(metric.value, metric.format)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}