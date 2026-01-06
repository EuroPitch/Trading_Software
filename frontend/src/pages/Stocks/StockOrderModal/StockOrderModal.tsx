import React, { useState, useEffect } from "react";
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
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [currentHoldings, setCurrentHoldings] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const totalValue = quantity * stock.price;

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        console.error("Auth error:", authError);
        return;
      }

      // Fetch cash balance
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("cash_balance")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching cash balance:", profileError);
      } else {
        setCashBalance(profileData?.cash_balance || 0);
      }

      // Fetch current holdings for this stock
      const { data: tradesData, error: tradesError } = await supabase
        .from("trades")
        .select("side, quantity")
        .eq("profile_id", user.id)
        .eq("symbol", stock.symbol);

      if (tradesError) {
        console.error("Error fetching holdings:", tradesError);
      } else if (tradesData) {
        // Calculate net position
        let netPosition = 0;
        tradesData.forEach((trade: any) => {
          const qty = Number(trade.quantity || 0);
          if (trade.side === "buy") {
            netPosition += qty;
          } else if (trade.side === "sell") {
            netPosition -= qty;
          }
        });
        setCurrentHoldings(netPosition);
      }

      setLoading(false);
    };

    fetchUserData();
  }, [stock.symbol]);

  const isValidOrder = () => {
    if (quantity <= 0) return false;
    
    if (action === "buy") {
      if (cashBalance === null) return false;
      return totalValue <= cashBalance;
    }
    
    return true;
  };

  const getErrorMessage = () => {
    if (quantity <= 0) return "Quantity must be greater than 0";
    
    if (action === "buy" && cashBalance !== null) {
      if (totalValue > cashBalance) {
        return `Insufficient funds. Available: €${cashBalance.toFixed(2)}, Required: €${totalValue.toFixed(2)}`;
      }
    }
    
    return null;
  };

  const handleExecute = async () => {
    if (!isValidOrder()) return;

    setIsProcessing(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error("Auth error:", authError);
      alert("You must be logged in to place trades");
      setIsProcessing(false);
      return;
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("trades")
      .insert([{
        profile_id: user.id,
        symbol: stock.symbol,
        side: action,
        quantity: quantity,
        price: stock.price,
        order_type: "market",
        placed_at: now,
        filled_at: now,
        created_by: user.id,
      }])
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
      `${action.toUpperCase()} order executed: ${quantity} shares of ${stock.symbol} at ${new Intl.NumberFormat("en-UK", {
        style: "currency",
        currency: "EUR",
      }).format(stock.price)}`
    );

    if (onClose) {
      onClose();
    }
  };

  const errorMessage = getErrorMessage();

  return (
    <div className="stock-order-modal">
      <h2 className="modal-title">Trade {stock.symbol}</h2>

      <div className="current-price">
        <span className="label">Current Price</span>
        <span className="value">
          {new Intl.NumberFormat("en-UK", {
            style: "currency",
            currency: "EUR",
          }).format(stock.price)}
        </span>
      </div>

      <div className="account-info">
        {cashBalance !== null && (
          <div className="cash-balance">
            Available Cash: €{cashBalance.toFixed(2)}
          </div>
        )}
        <div className="current-holdings">
          Current Holdings: {currentHoldings.toFixed(2)} shares
        </div>
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
        <label className="label">Quantity</label>
        <input
          type="number"
          className="order-input"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
          min="1"
          disabled={loading}
        />
      </div>

      <div className="order-summary">
        <div className="summary-row">
          <span className="label">Total Value:</span>
          <span className="value">
            {new Intl.NumberFormat("en-UK", {
              style: "currency",
              currency: "EUR",
            }).format(totalValue)}
          </span>
        </div>
      </div>

      {errorMessage && (
        <div className="error-message">{errorMessage}</div>
      )}

      <div className="modal-actions">
        <button
          className={`btn execute ${action}`}
          onClick={handleExecute}
          disabled={!isValidOrder() || isProcessing || loading}
        >
          {isProcessing
            ? "Processing..."
            : `${action === "buy" ? "Buy" : "Sell"} ${quantity} Shares`}
        </button>
      </div>
    </div>
  );
}