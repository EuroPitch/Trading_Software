import React, { useEffect, useRef } from "react";
import "./StockChart.css";

interface StockChartProps {
  symbol: string;
}

const StockChart: React.FC<StockChartProps> = ({ symbol }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadWidget = () => {
      if (containerRef.current) {
        // Clear previous content
        containerRef.current.innerHTML = "";

        // Create the script
        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = JSON.stringify({
          width: "100%",
          height: "100%",
          symbol: symbol,
          interval: "D",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          enable_publishing: false,
          allow_symbol_change: true,
          calendar: false,
          hide_side_toolbar: false,
          support_host: "https://www.tradingview.com"
        });

        containerRef.current.appendChild(script);
      }
    };

    loadWidget();
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol]);

  return (
    <div className="stock-chart-container">
      <div 
        ref={containerRef}
        style={{ 
          height: "400px", 
          width: "100%",
          minHeight: "400px",
          position: "relative"
        }}
      />
    </div>
  );
};

export default StockChart;
