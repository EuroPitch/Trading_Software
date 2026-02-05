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

export const CompetitionScoreProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [competitionScore, setCompetitionScore] = useState<CompetitionScore>({
    returnScore: 0,
    riskScore: 0,
    consistencyScore: 0,
    activityScore: 0,
    totalScore: 0,
  });
  const [loading, setLoading] = useState(false);
  const { session } = useAuth();

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
  }, [session?.user?.id]);

  // Initial fetch
  useEffect(() => {
    fetchCompetitionScore();
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
          console.log("🔥 Competition score updated:", payload);
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
      .subscribe();

    return () => {
      console.log("🔌 Cleaning up Realtime subscription for score");
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Refresh when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && session?.user?.id) {
        console.log("🔄 Tab focused - refreshing competition score");
        fetchCompetitionScore();
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