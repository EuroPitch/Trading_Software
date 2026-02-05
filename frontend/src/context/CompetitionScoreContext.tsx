import React, { createContext, useContext, useState } from "react";

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

  return (
    <CompetitionScoreContext.Provider
      value={{ competitionScore, setCompetitionScore }}
    >
      {children}
    </CompetitionScoreContext.Provider>
  );
};

export const useCompetitionScore = () => {
  const context = useContext(CompetitionScoreContext);
  if (!context) {
    throw new Error(
      "useCompetitionScore must be used within CompetitionScoreProvider",
    );
  }
  return context;
};
