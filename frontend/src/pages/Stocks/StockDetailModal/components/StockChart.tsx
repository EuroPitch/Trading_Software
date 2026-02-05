import React, { useState, useEffect } from "react";
import "./StockChart.css";

interface StockChartProps {
  symbol: string;
}

const StockChart: React.FC<StockChartProps> = ({ symbol }) => {
  const [timeframe, setTimeframe] = useState("1M");
  const [chartType, setChartType] = useState("line");
  const [indicators, setIndicators] = useState({
    sma20: false,
    sma50: false,
    sma200: false,
    bb: false,
    rsi: false,
    macd: false,
    volume: true,
  });
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChartData();
  }, [symbol, timeframe]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://trading-software.onrender.com/equities/chart/${symbol}?timeframe=${timeframe}`,
      );
      const result = await response.json();

      if (result.data && Array.isArray(result.data)) {
        setChartData(result.data);
      } else {
        setChartData([]);
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleIndicator = (indicator: keyof typeof indicators) => {
    setIndicators((prev) => ({
      ...prev,
      [indicator]: !prev[indicator],
    }));
  };

  return (
    <div className="stock-chart-container">
      <div className="chart-controls">
        <div className="timeframe-selector">
          {["1D", "1W", "1M", "3M", "1Y", "5Y"].map((tf) => (
            <button
              key={tf}
              className={`timeframe-btn ${timeframe === tf ? "active" : ""}`}
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="chart-type-selector">
          <button
            className={`chart-type-btn ${chartType === "line" ? "active" : ""}`}
            onClick={() => setChartType("line")}
            title="Line Chart"
          >
            📈
          </button>
          <button
            className={`chart-type-btn ${chartType === "candlestick" ? "active" : ""}`}
            onClick={() => setChartType("candlestick")}
            title="Candlestick Chart"
          >
            🕯️
          </button>
        </div>

        <div className="indicator-toggles">
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={indicators.sma20}
              onChange={() => toggleIndicator("sma20")}
            />
            <span>SMA 20</span>
          </label>
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={indicators.sma50}
              onChange={() => toggleIndicator("sma50")}
            />
            <span>SMA 50</span>
          </label>
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={indicators.bb}
              onChange={() => toggleIndicator("bb")}
            />
            <span>Bollinger Bands</span>
          </label>
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={indicators.rsi}
              onChange={() => toggleIndicator("rsi")}
            />
            <span>RSI</span>
          </label>
          <label className="indicator-toggle">
            <input
              type="checkbox"
              checked={indicators.macd}
              onChange={() => toggleIndicator("macd")}
            />
            <span>MACD</span>
          </label>
        </div>
      </div>

      <div className="chart-display">
        {loading ? (
          <div className="chart-loading">Loading chart data...</div>
        ) : chartData && chartData.length > 0 ? (
          <div className="chart-placeholder">
            <div className="chart-price-range">
              <div className="price-stat">
                <span className="price-label">High</span>
                <span className="price-value">
                  ${Math.max(...chartData.map((d) => d.high)).toFixed(2)}
                </span>
              </div>
              <div className="price-stat">
                <span className="price-label">Current</span>
                <span className="price-value">
                  ${chartData[chartData.length - 1].close.toFixed(2)}
                </span>
              </div>
              <div className="price-stat">
                <span className="price-label">Low</span>
                <span className="price-value">
                  ${Math.min(...chartData.map((d) => d.low)).toFixed(2)}
                </span>
              </div>
            </div>
            <p className="chart-note">
              {symbol} - {timeframe}
            </p>
            <p className="integration-note">
              📊 Chart rendering for {chartData.length} data points
            </p>
            <p className="integration-note">
              Active indicators:{" "}
              {Object.entries(indicators)
                .filter(([_, enabled]) => enabled)
                .map(([key, _]) => key)
                .join(", ") || "None"}
            </p>
          </div>
        ) : (
          <div className="chart-placeholder">
            <p>No data available for {symbol}</p>
            <p className="integration-note">
              Try a different timeframe or check if the symbol is valid
            </p>
          </div>
        )}
      </div>

      {indicators.volume && (
        <div className="volume-chart">
          <div className="chart-placeholder volume-placeholder">
            Volume Chart
          </div>
        </div>
      )}

      {indicators.rsi && (
        <div className="oscillator-chart">
          <div className="chart-placeholder oscillator-placeholder">
            RSI Indicator
          </div>
        </div>
      )}

      {indicators.macd && (
        <div className="oscillator-chart">
          <div className="chart-placeholder oscillator-placeholder">
            MACD Indicator
          </div>
        </div>
      )}
    </div>
  );
};

export default StockChart;
