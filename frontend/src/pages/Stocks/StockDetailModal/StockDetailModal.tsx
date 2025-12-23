import React, { useState } from "react";
import "./StockDetailModal.css";
import StockOrderModal from "../StockOrderModal/StockOrderModal";

export default function StockDetailModal({ stock, onClose }: any) {
  const [activeTab, setActiveTab] = useState("valuation");

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

  const tabs: any = {
    valuation: [
      { label: "Market Cap", value: stock.marketCap, format: "marketCap" },
      { label: "P/E Ratio", value: stock.peRatio, format: "decimal" },
      { label: "P/B Ratio", value: stock.pbRatio, format: "decimal" },
      { label: "PEG Ratio", value: stock.pegRatio, format: "decimal" },
      {
        label: "Dividend Yield",
        value: stock.dividendYield,
        format: "percent",
      },
      { label: "Beta", value: stock.beta, format: "decimal" },
    ],
    profitability: [
      { label: "ROE", value: stock.roe, format: "percent" },
      { label: "ROA", value: stock.roa, format: "percent" },
      { label: "Gross Margin", value: stock.grossMargin, format: "percent" },
      {
        label: "Operating Margin",
        value: stock.operatingMargin,
        format: "percent",
      },
      { label: "Net Margin", value: stock.netMargin, format: "percent" },
    ],
    growth: [
      {
        label: "Revenue Growth",
        value: stock.revenueGrowth,
        format: "percent",
      },
      {
        label: "Earnings Growth",
        value: stock.earningsGrowth,
        format: "percent",
      },
    ],
    technical: [
      { label: "Current Price", value: stock.price, format: "currency" },
      {
        label: "Change",
        value: stock.change,
        format: "currency",
        colored: true,
      },
      {
        label: "Change %",
        value: stock.changePercent,
        format: "percent",
        colored: true,
      },
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{stock.symbol}</h2>
            <p className="modal-subtitle">{stock.name}</p>
          </div>
          <button className="btn-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="stock-summary">
          <div className="summary-item">
            <span className="summary-label">Price</span>
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
              {formatValue(stock.change, "currency")} (
              {formatValue(stock.changePercent, "percent")})
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Sector</span>
            <span className="summary-value">{stock.sector}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Market Cap</span>
            <span className="summary-value">
              {formatValue(stock.marketCap, "marketCap")}
            </span>
          </div>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-button ${activeTab === "valuation" ? "active" : ""}`}
            onClick={() => setActiveTab("valuation")}
          >
            Valuation
          </button>
          <button
            className={`tab-button ${activeTab === "profitability" ? "active" : ""}`}
            onClick={() => setActiveTab("profitability")}
          >
            Profitability
          </button>
          <button
            className={`tab-button ${activeTab === "growth" ? "active" : ""}`}
            onClick={() => setActiveTab("growth")}
          >
            Growth
          </button>
          <button
            className={`tab-button ${activeTab === "technical" ? "active" : ""}`}
            onClick={() => setActiveTab("technical")}
          >
            Technical
          </button>
          <button
            className={`tab-button ${activeTab === "financial" ? "active" : ""}`}
            onClick={() => setActiveTab("financial")}
          >
            Financial
          </button>
          <button
            className={`tab-button ${activeTab === "order" ? "active" : ""}`}
            onClick={() => setActiveTab("order")}
          >
            Trade
          </button>
        </div>

        <div className="modal-body">
          {activeTab === "order" ? (
            <StockOrderModal 
              stock={stock} 
              onClose={onClose}
              onExecuteTrade={(trade) => {
                console.log("Trade executed:", trade);
                // Handle trade execution here - hook up to your Supabase or FastAPI backend
              }}
            />
          ) : (
            <div className="metrics-grid">
              {tabs[activeTab]?.map((metric: any, index: number) => (
                <div key={index} className="metric-item">
                  <span className="metric-label">{metric.label}</span>
                  <span
                    className={`metric-value ${
                      metric.colored && metric.value < 0
                        ? "negative"
                        : metric.colored && metric.value >= 0
                        ? "positive"
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

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary">Add to Watchlist</button>
        </div>
      </div>
    </div>
  );
}