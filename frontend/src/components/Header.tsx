// src/components/Header.tsx
import { NavLink } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/EuroPitch_logo.png";
import { useAuth } from "../context/AuthContext";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { session, loading } = useAuth();

  const isAuthenticated = !!session && !loading;

  const navItems = [
    { path: "/portfolio", label: "Portfolio" },
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
      </div>
    </header>
  );
};

export default Header;