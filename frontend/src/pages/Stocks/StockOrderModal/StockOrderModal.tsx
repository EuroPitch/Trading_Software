import React, { useState } from "react";
import { supabase } from "../../../supabaseClient";
import "./StockOrderModal.css";

interface TradeFormProps {
  stock: any;
  onExecuteTrade?: (trade: any) => void;
  onClose?: () => void;
}

export default function TradeForm({ stock, onExecuteTrade, onClose }: TradeFormProps) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const totalValue = quantity * stock.price;
  const isValidOrder = quantity > 0;

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
          side: action,
          quantity: quantity,
          price: stock.price,
          order_type: "market",
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
      } at ${new Intl.NumberFormat("en-UK", {
        style: "currency",
        currency: "EUR",
      }).format(stock.price)}`
    );

    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="stock-order-modal">
      <h2 className="modal-title">Trade {stock.symbol}</h2>

      <div className="stock-header">
        <div>
          <span className="stock-symbol">{stock.symbol}</span>
          <span className="stock-name">{stock.name || stock.symbol}</span>
        </div>
      </div>

      <div className="current-price">
        <span className="label">Current Price</span>
        <span className="value">
          {new Intl.NumberFormat("en-UK", {
            style: "currency",
            currency: "EUR",
          }).format(stock.price)}
        </span>
      </div>

      <div className="section">
        <span className="label">Action</span>
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

      <div className="section">
        <label className="label" htmlFor="quantity">
          Quantity
        </label>
        <input
          id="quantity"
          type="number"
          min="0"
          step="1"
          value={quantity || ""}
          onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
          placeholder="Enter quantity"
          className="order-input"
        />
      </div>

      <div className="order-summary">
        <div className="summary-row">
          <span className="label">Order Type</span>
          <span className="value">Market</span>
        </div>
        <div className="summary-row">
          <span className="label">Execution Price</span>
          <span className="value">
            {new Intl.NumberFormat("en-UK", {
              style: "currency",
              currency: "EUR",
            }).format(stock.price)}
          </span>
        </div>
        <div className="summary-row">
          <span className="label">Total Value</span>
          <span className="value">
            {new Intl.NumberFormat("en-UK", {
              style: "currency",
              currency: "EUR",
            }).format(totalValue)}
          </span>
        </div>
      </div>

      <div className="modal-actions">
        <button className="btn cancel" onClick={onClose}>
          Cancel
        </button>
        <button
          className={`btn execute ${action}`}
          onClick={handleExecute}
          disabled={!isValidOrder || isProcessing}
        >
          {isProcessing
            ? "Processing..."
            : `${action === "buy" ? "Buy" : "Sell"} ${quantity} Shares`}
        </button>
      </div>
    </div>
  );
}