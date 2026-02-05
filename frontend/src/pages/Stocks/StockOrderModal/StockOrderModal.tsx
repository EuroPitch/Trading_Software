import React, { useState, useEffect } from "react";
import { supabase } from "../../../supabaseClient";
import "./StockOrderModal.css";

interface TradeFormProps {
  stock: any;
  onExecuteTrade?: (trade: any) => void;
  onClose?: () => void;
}

export default function TradeForm({
  stock,
  onExecuteTrade,
  onClose,
}: TradeFormProps) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [currentHoldings, setCurrentHoldings] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const totalValue = quantity * stock.price;

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

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

    // For sell (short) action, check if we're going short and validate margin requirement
    if (action === "sell") {
      if (cashBalance === null) return false;

      // If we have holdings, selling reduces the position
      if (currentHoldings > 0) {
        // Selling existing long position - allowed if quantity <= holdings
        return quantity <= currentHoldings;
      } else {
        // Going short - need 150% of short position value in cash balance
        const shortPositionValue = quantity * stock.price;
        const requiredCash = shortPositionValue * 1.5;
        return cashBalance >= requiredCash;
      }
    }

    return true;
  };

  const getErrorMessage = () => {
    if (quantity <= 0) return "Quantity must be greater than 0";

    if (action === "buy" && cashBalance !== null) {
      if (totalValue > cashBalance) {
        return `Insufficient funds. You have €${cashBalance.toFixed(2)}, but require €${totalValue.toFixed(2)}`;
      }
    }

    if (action === "sell" && cashBalance !== null) {
      if (currentHoldings > 0) {
        // Selling existing long position
        if (quantity > currentHoldings) {
          const excessQuantity = quantity - currentHoldings;
          const excessValue = excessQuantity * stock.price;
          const requiredCash = excessValue * 1.5;
          return `Cannot short more than your margin allows. To short ${excessQuantity} shares, you would need €${requiredCash.toFixed(2)}, but you have €${cashBalance.toFixed(2)}`;
        }
      } else {
        // Going short (no existing holdings or negative balance)
        const shortPositionValue = quantity * stock.price;
        const requiredCash = shortPositionValue * 1.5;
        if (cashBalance < requiredCash) {
          return `Insufficient margin for shorting. To short ${quantity} shares, you would need €${requiredCash.toFixed(2)}, but you have €${cashBalance.toFixed(2)}`;
        }
      }
    }

    return null;
  };

  const handleExecute = async () => {
    if (!isValidOrder()) return;

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
      `${action.toUpperCase()} order executed: ${quantity} shares of ${stock.symbol} at ${new Intl.NumberFormat(
        "en-UK",
        {
          style: "currency",
          currency: "EUR",
        },
      ).format(stock.price)}`,
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
          onChange={(e) => setQuantity(parseInt(e.target.value))}
          min="1"
          disabled={loading}
        />
      </div>

      <div className="order-summary">
        <div className="summary-row">
          <span className="label">Total Value:</span>
          <span className="value">
            {isNaN(totalValue) || !totalValue
              ? "$0.00"
              : new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: "USD",
                }).format(totalValue)}
          </span>
        </div>
      </div>

      {errorMessage && <div className="error-message">{errorMessage}</div>}

      <div className="modal-actions">
        <button
          className={`btn execute ${action}`}
          onClick={handleExecute}
          disabled={!isValidOrder() || isProcessing || loading || isNaN(quantity)}
        >
          {isProcessing
            ? "Processing..."
            : isNaN(quantity) || !quantity
            ? `${action === "buy" ? "Buy" : "Sell"} Shares`
            : `${action === "buy" ? "Buy" : "Sell"} ${quantity} ${quantity === 1 ? "Share" : "Shares"}`}
        </button>
      </div>
    </div>
  );
}
