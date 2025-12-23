import React, { useState } from "react";
import "./StockOrderModal.css";

interface StockOrderModalProps {
  stock: any;
  onClose: () => void;
  onExecuteTrade?: (trade: TradeOrder) => void;
}

interface TradeOrder {
  symbol: string;
  orderType: "market" | "limit";
  action: "buy" | "sell";
  quantity: number;
  limitPrice?: number;
  totalValue: number;
}

export default function StockOrderModal({ stock, onClose, onExecuteTrade }: StockOrderModalProps) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState<number>(0);
  const [limitPrice, setLimitPrice] = useState<number>(stock.price);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectivePrice = orderType === "market" ? stock.price : limitPrice;
  const totalValue = quantity * effectivePrice;
  const isValidOrder = quantity > 0 && (orderType === "market" || (orderType === "limit" && limitPrice > 0));

  const handleExecute = async () => {
    if (!isValidOrder) return;

    setIsProcessing(true);
    
    const trade: TradeOrder = {
      symbol: stock.symbol,
      orderType,
      action,
      quantity,
      limitPrice: orderType === "limit" ? limitPrice : undefined,
      totalValue,
    };

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));

    if (onExecuteTrade) {
      onExecuteTrade(trade);
    }

    setIsProcessing(false);
    alert(`${action.toUpperCase()} order executed: ${quantity} shares of ${stock.symbol}`);
    onClose();
  };

  return (
    <div className="order-modal-container">
      <div className="order-header">
        <div>
          <h3>Execute Trade</h3>
          <p className="order-subtitle">{stock.symbol} - {stock.name}</p>
        </div>
        <div className="current-price">
          <span className="price-label">Current Price</span>
          <span className="price-value">${stock.price.toFixed(2)}</span>
        </div>
      </div>

      <div className="order-body">
        {/* Action Toggle */}
        <div className="order-section">
          <label className="section-label">Action</label>
          <div className="action-toggle">
            <button
              className={`toggle-btn buy ${action === "buy" ? "active" : ""}`}
              onClick={() => setAction("buy")}
            >
              Buy
            </button>
            <button
              className={`toggle-btn sell ${action === "sell" ? "active" : ""}`}
              onClick={() => setAction("sell")}
            >
              Sell
            </button>
          </div>
        </div>

        {/* Order Type */}
        <div className="order-section">
          <label className="section-label">Order Type</label>
          <div className="order-type-toggle">
            <button
              className={`toggle-btn ${orderType === "market" ? "active" : ""}`}
              onClick={() => setOrderType("market")}
            >
              Market Order
            </button>
            <button
              className={`toggle-btn ${orderType === "limit" ? "active" : ""}`}
              onClick={() => setOrderType("limit")}
            >
              Limit Order
            </button>
          </div>
        </div>

        {/* Quantity Input */}
        <div className="order-section">
          <label className="section-label" htmlFor="quantity">
            Quantity (Shares)
          </label>
          <input
            id="quantity"
            type="number"
            min="0"
            step="1"
            value={quantity || ""}
            onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
            className="order-input"
            placeholder="Enter number of shares"
          />
        </div>

        {/* Limit Price Input */}
        {orderType === "limit" && (
          <div className="order-section">
            <label className="section-label" htmlFor="limitPrice">
              Limit Price ($)
            </label>
            <input
              id="limitPrice"
              type="number"
              min="0"
              step="0.01"
              value={limitPrice || ""}
              onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
              className="order-input"
              placeholder="Enter limit price"
            />
          </div>
        )}

        {/* Order Summary */}
        <div className="order-summary">
          <div className="summary-row">
            <span className="summary-label">Shares</span>
            <span className="summary-value">{quantity}</span>
          </div>
          <div className="summary-row">
            <span className="summary-label">Price per Share</span>
            <span className="summary-value">${effectivePrice.toFixed(2)}</span>
          </div>
          <div className="summary-row total">
            <span className="summary-label">Total {action === "buy" ? "Cost" : "Proceeds"}</span>
            <span className="summary-value">${totalValue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="order-footer">
        <button className="btn-order-cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn-order-execute ${action}`}
          onClick={handleExecute}
          disabled={!isValidOrder || isProcessing}
        >
          {isProcessing ? "Processing..." : `${action === "buy" ? "Buy" : "Sell"} ${stock.symbol}`}
        </button>
      </div>
    </div>
  );
}