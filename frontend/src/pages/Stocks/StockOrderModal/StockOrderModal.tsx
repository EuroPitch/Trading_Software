import React, { useState } from "react";
import { supabase } from "../../../supabaseClient";

interface TradeFormProps {
  stock: any;
  onExecuteTrade?: (trade: any) => void;
  onClose?: () => void;
}

export default function TradeForm({ stock, onExecuteTrade, onClose }: TradeFormProps) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState(0);
  const [limitPrice, setLimitPrice] = useState(stock.price);
  const [isProcessing, setIsProcessing] = useState(false);

  const effectivePrice = orderType === "market" ? stock.price : limitPrice;
  const totalValue = quantity * effectivePrice;
  const isValidOrder =
    quantity > 0 &&
    (orderType === "market" || (orderType === "limit" && limitPrice > 0));

  const handleExecute = async () => {
    if (!isValidOrder) return;

    setIsProcessing(true);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      alert("You must be logged in to place trades");
      setIsProcessing(false);
      return;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("trades")
      .insert([
        {
          profile_id: user.id,
          symbol: stock.symbol,
          name: stock.name || stock.symbol,
          side: action,
          quantity: quantity,
          price: effectivePrice,
          order_type: orderType,
          placed_at: now,
          filled_at: now,
          created_by: user.id,
        },
      ])
      .select();

    if (error) {
      console.error("Error inserting trade:", error);
      alert(`Failed to execute order: ${error.message || "Unknown error"}`);
      setIsProcessing(false);
      return;
    }

    console.log("Trade inserted successfully:", data);

    if (onExecuteTrade) {
      onExecuteTrade(data[0]);
    }

    setIsProcessing(false);
    alert(
      `${action.toUpperCase()} order executed: ${quantity} shares of ${
        stock.symbol
      }`
    );

    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="trade-form-content">
      {/* Action Toggle */}
      <div className="trade-section">
        <label className="trade-label">ACTION</label>
        <div className="action-toggle">
          <button
            className={`toggle-button ${action === "buy" ? "active buy" : ""}`}
            onClick={() => setAction("buy")}
          >
            Buy
          </button>
          <button
            className={`toggle-button ${action === "sell" ? "active sell" : ""}`}
            onClick={() => setAction("sell")}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Order Type Toggle */}
      <div className="trade-section">
        <label className="trade-label">ORDER TYPE</label>
        <div className="order-type-toggle">
          <button
            className={`toggle-button ${orderType === "market" ? "active" : ""}`}
            onClick={() => setOrderType("market")}
          >
            Market
          </button>
          <button
            className={`toggle-button ${orderType === "limit" ? "active" : ""}`}
            onClick={() => setOrderType("limit")}
          >
            Limit
          </button>
        </div>
      </div>

      {/* Quantity Input */}
      <div className="trade-section">
        <label className="trade-label">QUANTITY (SHARES)</label>
        <input
          type="number"
          className="trade-input"
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          placeholder="Enter quantity"
          min="0"
        />
      </div>

      {/* Limit Price (conditional) */}
      {orderType === "limit" && (
        <div className="trade-section">
          <label className="trade-label">LIMIT PRICE</label>
          <input
            type="number"
            className="trade-input"
            value={limitPrice}
            onChange={(e) => setLimitPrice(Number(e.target.value))}
            placeholder="Enter limit price"
            step="0.01"
            min="0"
          />
        </div>
      )}

      {/* Order Summary */}
      <div className="trade-summary">
        <div className="summary-row">
          <span>Shares</span>
          <span>{quantity}</span>
        </div>
        <div className="summary-row">
          <span>Price per Share</span>
          <span>${effectivePrice.toFixed(2)}</span>
        </div>
        <div className="summary-row total">
          <span>Total Cost</span>
          <span>${totalValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Execute Button */}
      <button
        className={`btn-execute ${action}`}
        onClick={handleExecute}
        disabled={!isValidOrder || isProcessing}
      >
        {isProcessing
          ? "PROCESSING..."
          : `${action.toUpperCase()} ${stock.symbol}`}
      </button>
    </div>
  );
}