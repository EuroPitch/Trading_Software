import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import { supabase } from "../../supabaseClient";

export default function Signup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    societyName: "",
    societyEmail: "",
    password: "",
    confirmPassword: "",
  } as any);
  const [errors, setErrors] = useState({} as any);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const validate = () => {
    const newErrors: any = {};
    if (!formData.societyName || !formData.societyName.trim()) {
      newErrors.societyName = "Society name is required";
    } else if (formData.societyName.trim().length < 3) {
      newErrors.societyName = "Society name must be at least 3 characters";
    }

    if (!formData.societyEmail) {
      newErrors.societyEmail = "Email is required";
    } else if (
      !/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.societyEmail)
    ) {
      newErrors.societyEmail = "Invalid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
    if ((errors as any)[name])
      setErrors((prev: any) => ({ ...prev, [name]: "" }));
    setGlobalError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setGlobalSuccess(null);
    if (!validate()) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: formData.societyEmail,
      password: formData.password,
      options: {
        data: {
          society_name: formData.societyName,
        },
      },
    });

    setLoading(false);

    if (error) {
      console.error("Supabase signup error:", error);
      setGlobalError(error.message);
      return;
    }

    // Minimal local state for client routing
    localStorage.setItem("isAuthenticated", "true");
    localStorage.setItem("societyName", formData.societyName);

    setGlobalSuccess("Registration successful. Redirecting to portfolio...");
    navigate("/portfolio");
  };

  return (
    <div className="auth-container">
      <div className="auth-wrapper society-wrapper">
        <div className="auth-card society-card">
          <div className="auth-header">
            <div className="auth-logo">
              <h1>EuroPitch Portfolio Challenge</h1>
            </div>
            <h2>Register Your Society</h2>
            <p>
              Sign up with your society name and email to join the challenge
            </p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {globalError && <div className="error-banner">{globalError}</div>}
            {globalSuccess && (
              <div className="success-banner">{globalSuccess}</div>
            )}

            <div className="form-group">
              <label htmlFor="societyName">Society Name *</label>
              <input
                type="text"
                id="societyName"
                name="societyName"
                value={formData.societyName}
                onChange={handleChange}
                className={errors.societyName ? "error" : ""}
                placeholder="Investment Society Name"
                autoComplete="organization"
              />
              {errors.societyName && (
                <span className="error-message">{errors.societyName}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="societyEmail">Society Email *</label>
              <input
                type="email"
                id="societyEmail"
                name="societyEmail"
                value={formData.societyEmail}
                onChange={handleChange}
                className={errors.societyEmail ? "error" : ""}
                placeholder="society@university.edu"
                autoComplete="email"
              />
              {errors.societyEmail && (
                <span className="error-message">{errors.societyEmail}</span>
              )}
              <p className="field-hint">
                This email will be used for official communications
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className={errors.password ? "error" : ""}
                  placeholder="Create a strong password"
                  autoComplete="new-password"
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
              {errors.password && (
                <span className="error-message">{errors.password}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <div className="password-input-wrapper">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className={errors.confirmPassword ? "error" : ""}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              {errors.confirmPassword && (
                <span className="error-message">{errors.confirmPassword}</span>
              )}
            </div>

            <div className="button-group">
              <button
                type="submit"
                className="btn-primary-auth"
                disabled={loading}
              >
                {loading ? (
                  <span className="loading-spinner-small">Registering...</span>
                ) : (
                  "Create account"
                )}
              </button>
            </div>

            <div className="auth-footer">
              <p>
                Already registered?{" "}
                <Link to="/" className="auth-link">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        </div>

        <div className="auth-sidebar">
          <div className="sidebar-content">
            <h3>European Portfolio Challenge</h3>
            <ul className="feature-list">
              <li>
                <div>
                  <strong>Team Competition</strong>
                  <p>Compete with university societies across Europe</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
