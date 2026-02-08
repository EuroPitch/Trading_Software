import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import { useAuth } from "./AuthContext";
import { RealtimeChannel } from "@supabase/supabase-js";

type CompetitionScore = {
  returnScore: number;
  riskScore: number;
  consistencyScore: number;
  activityScore: number;
  totalScore: number;
};

type CompetitionScoreContextType = {
  competitionScore: CompetitionScore;
  setCompetitionScore: (score: CompetitionScore) => void;
  refreshScore: () => Promise<void>;
  loading: boolean;
};

const CompetitionScoreContext = createContext<
  CompetitionScoreContextType | undefined
>(undefined);

const STORAGE_KEY = 'competition_score_cache';
const LAST_FETCH_KEY = 'competition_score_last_fetch';

export const CompetitionScoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Initialize from localStorage cache
  const [competitionScore, setCompetitionScoreState] = useState<CompetitionScore>(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        console.log("💾 Loaded competition scores from cache:", parsed);
        return parsed;
      } catch (err) {
        console.warn("Failed to parse cached scores:", err);
      }
    }
    return {
      returnScore: 0,
      riskScore: 0,
      consistencyScore: 0,
      activityScore: 0,
      totalScore: 0,
    };
  });

  const [loading, setLoading] = useState(false);
  const { session } = useAuth();

  // Wrapper to update both state and cache
  const setCompetitionScore = useCallback((score: CompetitionScore) => {
    setCompetitionScoreState(score);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(score));
    localStorage.setItem(LAST_FETCH_KEY, Date.now().toString());
  }, []);

  // Fetch competition score from Supabase
  const fetchCompetitionScore = useCallback(async () => {
    if (!session?.user?.id) {
      setCompetitionScore({
        returnScore: 0,
        riskScore: 0,
        consistencyScore: 0,
        activityScore: 0,
        totalScore: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "competition_score, return_score, risk_score, consistency_score, activity_score"
        )
        .eq("id", session.user.id)
        .single();

      if (error) throw error;

      if (data) {
        setCompetitionScore({
          returnScore: data.return_score || 0,
          riskScore: data.risk_score || 0,
          consistencyScore: data.consistency_score || 0,
          activityScore: data.activity_score || 0,
          totalScore: data.competition_score || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching competition score:", error);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, setCompetitionScore]);

  // Initial fetch ONLY if cache is stale (older than 2 minutes)
  useEffect(() => {
    const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
    const now = Date.now();
    const TWO_MINUTES = 2 * 60 * 1000;

    if (!lastFetch || now - parseInt(lastFetch) > TWO_MINUTES) {
      console.log("🔄 Cache stale, fetching fresh competition scores");
      fetchCompetitionScore();
    } else {
      console.log("✅ Using cached competition scores");
    }
  }, [fetchCompetitionScore]);

  // Supabase Realtime subscription for instant updates
  useEffect(() => {
    if (!session?.user?.id) return;

    console.log("📡 Setting up Realtime subscription for competition score");

    const channel: RealtimeChannel = supabase
      .channel(`profile:${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${session.user.id}`,
        },
        (payload) => {
          console.log("🔥 Competition score updated via Realtime:", payload);
          const newData = payload.new as any;
          setCompetitionScore({
            returnScore: newData.return_score || 0,
            riskScore: newData.risk_score || 0,
            consistencyScore: newData.consistency_score || 0,
            activityScore: newData.activity_score || 0,
            totalScore: newData.competition_score || 0,
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Realtime subscription active');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Realtime subscription failed');
        }
      });

    return () => {
      console.log("🔌 Cleaning up Realtime subscription for score");
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, setCompetitionScore]);

  // Smart refresh on tab visibility - only if cache is old
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session?.user?.id) {
        const lastFetch = localStorage.getItem(LAST_FETCH_KEY);
        const now = Date.now();
        const FIVE_MINUTES = 5 * 60 * 1000;

        if (!lastFetch || now - parseInt(lastFetch) > FIVE_MINUTES) {
          console.log("🔄 Tab focused + stale cache - refreshing competition score");
          fetchCompetitionScore();
        } else {
          console.log("⏭️ Tab focused but cache is fresh, skipping fetch");
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchCompetitionScore, session?.user?.id]);

  return (
    <CompetitionScoreContext.Provider
      value={{
        competitionScore,
        setCompetitionScore,
        refreshScore: fetchCompetitionScore,
        loading,
      }}
    >
      {children}
    </CompetitionScoreContext.Provider>
  );
};

export const useCompetitionScore = () => {
  const context = useContext(CompetitionScoreContext);
  if (!context) {
    throw new Error(
      "useCompetitionScore must be used within CompetitionScoreProvider"
    );
  }
  return context;
};