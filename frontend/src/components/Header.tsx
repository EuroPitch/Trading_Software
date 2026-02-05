// src/components/Header.tsx
import { NavLink } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/EuroPitch_logo.png";
import { useAuth } from "../context/AuthContext";
import { useCompetitionScore } from "../context/CompetitionScoreContext";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showScoreDropdown, setShowScoreDropdown] = useState(false);
  const { session, loading } = useAuth();
  const { competitionScore } = useCompetitionScore();

  const isAuthenticated = !!session && !loading;

  const navItems = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/stocks", label: "Stocks" },
  ];

  return (
    <header className="header">
      <div className="nav-container">
        <NavLink to="/" className="brand">
          <img src={logo} alt="EuroPitch Logo" className="logo" />
          <span className="brand-text"></span>
        </NavLink>

        <button
          className={`menu-toggle ${menuOpen ? "open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`nav-links ${menuOpen ? "active" : ""}`}>
          {isAuthenticated &&
            navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </NavLink>
            ))}
        </nav>

        {isAuthenticated && (
          <div className="header-score-container">
            <button
              className="competition-score-badge"
              onClick={() => setShowScoreDropdown(!showScoreDropdown)}
              title="Click to view detailed scores"
            >
              <div className="score-number">{competitionScore.totalScore}</div>
              <div className="score-label">Score</div>
            </button>

            {showScoreDropdown && (
              <div
                className="score-dropdown-overlay"
                onClick={() => setShowScoreDropdown(false)}
              >
                <div
                  className="score-dropdown"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="dropdown-item">
                    <span className="dropdown-label">Total Score</span>
                    <span className="dropdown-value total">
                      {competitionScore.totalScore}/100
                    </span>
                  </div>
                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Return (40%)</span>
                    <span className="dropdown-value">
                      {competitionScore.returnScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Risk (30%)</span>
                    <span className="dropdown-value">
                      {competitionScore.riskScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Consistency (20%)</span>
                    <span className="dropdown-value">
                      {competitionScore.consistencyScore}
                    </span>
                  </div>
                  <div className="dropdown-item">
                    <span className="dropdown-label">Activity (10%)</span>
                    <span className="dropdown-value">
                      {competitionScore.activityScore}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
