import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import { supabase } from "../../supabaseClient";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState({} as any);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null); // new

  const validateForm = () => {
    const newErrors: any = {};

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)
    ) {
      newErrors.email = "Invalid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if ((errors as any)[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
    setGlobalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setGlobalError(null);

    // REAL SUPABASE LOGIN
    const { data, error } = await supabase.auth.signInWithPassword({
      email: formData.email,
      password: formData.password,
    });

    setLoading(false);

    if (error) {
      console.error("Supabase login error:", error);
      setGlobalError(error.message); // e.g. "Invalid login credentials"
      return;
    }

    // Optional: store whether user is "logged in" for your own guards
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("userEmail", formData.email);

    console.log("Login successful:", data.user?.email);
    navigate("/dashboard");
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper single-column">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-icon">📈</div>
              <h1>EuroPitch Portfolio Challenge</h1>
            </div>
            <h2>Welcome Back</h2>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {globalError && (
              <div className="error-banner">
                {globalError}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={(errors as any).email ? "error" : ""}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {(errors as any).email && (
                <span className="error-message">
                  {(errors as any).email}
                </span>
              )}
            </div>

            <div className="form-group">
              <div className="label-row">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="forgot-link">
                  Forgot password?
                </Link>
              </div>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={(errors as any).password ? "error" : ""}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {(errors as any).password && (
                <span className="error-message">
                  {(errors as any).password}
                </span>
              )}
            </div>

            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" name="remember" />
                <span>Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn-primary-auth"
              disabled={loading}
            >
              {loading ? (
                <span className="loading-spinner-small">Signing in...</span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}