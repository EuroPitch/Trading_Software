import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import "./Standings.css";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../context/AuthContext";

type Profile = {
  id: string;
  society_name: string;
  total_equity: number;
  realized_pnl: number;
  initial_capital: number;
  competition_score: number;
  return_score: number;
  risk_score: number;
  consistency_score: number;
  activity_score: number;
};

export default function Standings() {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sortProfiles = useCallback((profileList: Profile[]) => {
    return [...profileList].sort((a, b) => {
      const scoreA = a.competition_score || 0;
      const scoreB = b.competition_score || 0;
      
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      
      return (b.realized_pnl || 0) - (a.realized_pnl || 0);
    });
  }, []);

  const fetchStandings = useCallback(async () => {
    if (profiles.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select(`
          id,
          society_name,
          total_equity,
          realized_pnl,
          initial_capital,
          competition_score,
          return_score,
          risk_score,
          consistency_score,
          activity_score
        `);

      if (fetchError) throw fetchError;

      const sortedProfiles = sortProfiles(data || []);
      setProfiles(sortedProfiles);
    } catch (err: any) {
      console.error("Error fetching standings:", err);
      setError(err?.message || "Failed to load standings");
    } finally {
      if (profiles.length === 0) {
        setLoading(false);
      }
    }
  }, [profiles.length, sortProfiles]);

  // Initial fetch
  useEffect(() => {
    fetchStandings();
  }, []);

  // Realtime subscription for instant updates
  useEffect(() => {
    console.log("📡 Setting up Realtime subscription for standings");

    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        (payload) => {
          console.log("🔥 Profile updated via Realtime:", payload.new);
          
          setProfiles((current) => {
            // Find and update the specific profile
            const updated = current.map((profile) => {
              if (profile.id === (payload.new as any).id) {
                return {
                  ...profile,
                  society_name: (payload.new as any).society_name || profile.society_name,
                  total_equity: (payload.new as any).total_equity ?? profile.total_equity,
                  realized_pnl: (payload.new as any).realized_pnl ?? profile.realized_pnl,
                  initial_capital: (payload.new as any).initial_capital ?? profile.initial_capital,
                  competition_score: (payload.new as any).competition_score ?? profile.competition_score,
                  return_score: (payload.new as any).return_score ?? profile.return_score,
                  risk_score: (payload.new as any).risk_score ?? profile.risk_score,
                  consistency_score: (payload.new as any).consistency_score ?? profile.consistency_score,
                  activity_score: (payload.new as any).activity_score ?? profile.activity_score,
                };
              }
              return profile;
            });

            // Re-sort after update
            return sortProfiles(updated);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Standings Realtime active');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Standings Realtime failed');
        }
      });

    return () => {
      console.log('🔌 Cleaning up Realtime subscription for standings');
      supabase.removeChannel(channel);
    };
  }, [sortProfiles]);

  // Reduced polling interval - only as backup since we have Realtime
  useEffect(() => {
    // Poll every 5 minutes as a safety net
    const interval = setInterval(fetchStandings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStandings]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-UK", { style: "currency", currency: "EUR" }).format(value);

  const formatPercent = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

  const calculateReturn = (profile: Profile) => {
    const initial = profile.initial_capital || 100000;
    if (initial === 0) return 0;
    return ((profile.total_equity - initial) / initial) * 100;
  };

  return (
    <div className="standings-container">
      <div className="standings-header">
        <h1>EuroPitch Portfolio Round Leaderboard</h1>
        <p className="subtitle">Track your society's performance against other societies</p>
      </div>

      {loading ? (
        <div className="loading">Loading leaderboard...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : profiles.length === 0 ? (
        <div className="empty-state">
          <p>No teams have joined yet. Be the first!</p>
        </div>
      ) : (
        <>
          {/* CLEAN PODIUM - Just medals, names, and scores */}
          {profiles.length >= 3 && (
            <div className="podium">
              <div className="podium-place second">
                <div className="podium-medal"></div>
                <h3 className="podium-society">{profiles[1].society_name}</h3>
                <div className="podium-score">{profiles[1].competition_score || 0} pts</div>
              </div>

              <div className="podium-place first">
                <div className="podium-medal"></div>
                <h3 className="podium-society">{profiles[0].society_name}</h3>
                <div className="podium-score">{profiles[0].competition_score || 0} pts</div>
              </div>

              <div className="podium-place third">
                <div className="podium-medal"></div>
                <h3 className="podium-society">{profiles[2].society_name}</h3>
                <div className="podium-score">{profiles[2].competition_score || 0} pts</div>
              </div>
            </div>
          )}

          <div className="score-breakdown-legend">
            <h3>Score Breakdown</h3>
            <div className="legend-items">
              <div className="legend-item">
                <span className="legend-weight">50%</span>
                <span className="legend-label">Return Score</span>
              </div>
              <div className="legend-item">
                <span className="legend-weight">25%</span>
                <span className="legend-label">Risk Score</span>
              </div>
              <div className="legend-item">
                <span className="legend-weight">15%</span>
                <span className="legend-label">Consistency Score</span>
              </div>
              <div className="legend-item">
                <span className="legend-weight">10%</span>
                <span className="legend-label">Activity Score</span>
              </div>
            </div>
          </div>

          <div className="standings-table-container">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="society-col">Society</th>
                  <th>Total Equity</th>
                  <th>P&L</th>
                  <th>Return %</th>
                  <th className="subscore-col">Return</th>
                  <th className="subscore-col">Risk</th>
                  <th className="subscore-col">Consistency</th>
                  <th className="subscore-col">Activity</th>
                  <th className="score-col">Competition Score</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile, index) => {
                  const returnPercent = calculateReturn(profile);
                  const isCurrentUser = session?.user?.id === profile.id;

                  return (
                    <tr key={profile.id} className={isCurrentUser ? "current-user" : ""}>
                      <td className="rank-col">
                        <span className={`rank-badge rank-${Math.min(index + 1, 4)}`}>
                          {index === 0 && "🥇"}
                          {index === 1 && "🥈"}
                          {index === 2 && "🥉"}
                          {index > 2 && `#${index + 1}`}
                        </span>
                      </td>
                      <td className="society-col">
                        <strong>{profile.society_name || "Unknown Society"}</strong>
                      </td>
                      <td>{formatCurrency(profile.total_equity || 0)}</td>
                      <td className={profile.realized_pnl >= 0 ? "positive" : "negative"}>
                        {formatCurrency(profile.realized_pnl || 0)}
                      </td>
                      <td className={returnPercent >= 0 ? "positive" : "negative"}>
                        {formatPercent(returnPercent)}
                      </td>
                      <td className="subscore-col">{profile.return_score || 0}</td>
                      <td className="subscore-col">{profile.risk_score || 0}</td>
                      <td className="subscore-col">{profile.consistency_score || 0}</td>
                      <td className="subscore-col">{profile.activity_score || 0}</td>
                      <td className="score-col">
                        <strong className="total-score">{profile.competition_score || 0}</strong>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="standings-footer">
            <p className="tiebreaker-note">
              In case of tied scores, P&L is used as tiebreaker
            </p>
            <p className="refresh-note">🔴 Realtime Live updates</p>
          </div>
        </>
      )}
    </div>
  );
}