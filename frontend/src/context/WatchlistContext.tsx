import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";

type WatchlistContextType = {
  watchlist: string[];
  loading: boolean;
  addToWatchlist: (symbol: string, name?: string) => Promise<void>;
  removeFromWatchlist: (symbol: string) => Promise<void>;
  refreshWatchlist: () => Promise<void>;
};

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export const WatchlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchWatchlist = useCallback(async () => {
    if (!session?.user?.id) {
      setWatchlist([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("watchlist")
        .select("symbol")
        .eq("profile_id", session.user.id);

      if (error) throw error;

      const symbols = data?.map((item) => item.symbol) || [];
      console.log("✅ Fetched watchlist:", symbols);
      setWatchlist(symbols);
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id]);

  const addToWatchlist = async (symbol: string, name?: string) => {
    if (!session?.user?.id) {
      alert("Please log in to add to watchlist");
      return;
    }

    console.log("➕ Adding to watchlist:", symbol);
    
    // Optimistically update UI IMMEDIATELY
    setWatchlist(prev => {
      if (prev.includes(symbol)) return prev; // Already in watchlist
      const updated = [...prev, symbol];
      console.log("🔄 Updated watchlist immediately:", updated);
      return updated;
    });

    try {
      await supabase.from("watchlist").insert({
        profile_id: session.user.id,
        symbol: symbol,
        name: name || symbol,
      });
      
      console.log("✅ Successfully added to DB");
    } catch (err) {
      console.error("❌ Error adding to watchlist:", err);
      // Revert on error
      fetchWatchlist();
    }
  };

  const removeFromWatchlist = async (symbol: string) => {
    if (!session?.user?.id) return;

    console.log("🗑️ Removing from watchlist:", symbol);
    
    // Optimistically update UI IMMEDIATELY
    setWatchlist(prev => {
      const updated = prev.filter((s) => s !== symbol);
      console.log("🔄 Updated watchlist immediately:", updated);
      return updated;
    });

    try {
      await supabase
        .from("watchlist")
        .delete()
        .eq("profile_id", session.user.id)
        .eq("symbol", symbol);
      
      console.log("✅ Successfully removed from DB");
    } catch (err) {
      console.error("❌ Error removing from watchlist:", err);
      // Revert on error
      fetchWatchlist();
    }
  };

  // Initial fetch
  useEffect(() => {
    if (session?.user?.id) {
      console.log("🔄 Initial watchlist fetch");
      fetchWatchlist();
      
      // Poll every 30 seconds for DB changes from other sources
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        console.log("⏰ Auto-refreshing watchlist");
        fetchWatchlist();
      }, 30000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [session?.user?.id, fetchWatchlist]);

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session?.user?.id) {
        console.log("👀 Tab focused - refreshing watchlist");
        fetchWatchlist();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [fetchWatchlist, session?.user?.id]);

  return (
    <WatchlistContext.Provider
      value={{
        watchlist,
        loading,
        addToWatchlist,
        removeFromWatchlist,
        refreshWatchlist: fetchWatchlist,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
};

export const useWatchlist = () => {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error("useWatchlist must be used within WatchlistProvider");
  }
  return context;
};