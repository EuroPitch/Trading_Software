import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Auth.css';

export default function Signup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    societyName: '',
    societyEmail: '',
    country: '',
    password: '',
    confirmPassword: '',
    participants: Array.from({ length: 6 }, () => ({ firstName: '', lastName: '', email: '' })),
    captainIndex: 0
  } as any);
  const [errors, setErrors] = useState({} as any);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const europeanCountries = [
    'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herzegovina',
    'Bulgaria', 'Croatia', 'Cyprus', 'Czech Republic', 'Denmark', 'Estonia',
    'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Iceland', 'Ireland',
    'Italy', 'Kosovo', 'Latvia', 'Liechtenstein', 'Lithuania', 'Luxembourg',
    'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'North Macedonia',
    'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'San Marino', 'Serbia',
    'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
    'Vatican City'
  ];

  const validateStep1 = () => {
    const newErrors: any = {};

    if (!formData.societyName.trim()) {
      newErrors.societyName = 'Society name is required';
    } else if (formData.societyName.trim().length < 3) {
      newErrors.societyName = 'Society name must be at least 3 characters';
    }

    if (!formData.societyEmail) {
      newErrors.societyEmail = 'Society email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.societyEmail)) {
      newErrors.societyEmail = 'Invalid email address';
    }

    if (!formData.country) {
      newErrors.country = 'Please select a country';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: any = {};

    for (let i = 0; i < 4; i++) {
      const participant = formData.participants[i];
      if (!participant.firstName.trim()) newErrors[`participant${i}FirstName`] = 'First name is required';
      if (!participant.lastName.trim()) newErrors[`participant${i}LastName`] = 'Last name is required';
      if (!participant.email) newErrors[`participant${i}Email`] = 'Email is required';
      else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(participant.email)) newErrors[`participant${i}Email`] = 'Invalid email address';
    }

    for (let i = 4; i < 6; i++) {
      const participant = formData.participants[i];
      const hasAnyField = participant.firstName || participant.lastName || participant.email;
      if (hasAnyField) {
        if (!participant.firstName.trim()) newErrors[`participant${i}FirstName`] = 'First name is required if adding participant';
        if (!participant.lastName.trim()) newErrors[`participant${i}LastName`] = 'Last name is required if adding participant';
        if (!participant.email) newErrors[`participant${i}Email`] = 'Email is required if adding participant';
        else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(participant.email)) newErrors[`participant${i}Email`] = 'Invalid email address';
      }
    }

    const emails = formData.participants.filter((p: any) => p.email).map((p: any) => p.email.toLowerCase());
    const duplicates = emails.filter((email: string, index: number) => emails.indexOf(email) !== index);
    if (duplicates.length > 0) newErrors.duplicateEmails = 'Each participant must have a unique email address';

    if (!agreedToTerms) newErrors.terms = 'You must agree to the terms and conditions';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target as HTMLInputElement;
    setFormData(prev => ({ ...prev, [name]: value }));
    if ((errors as any)[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleParticipantChange = (index: number, field: string, value: string) => {
    const newParticipants = [...formData.participants];
    newParticipants[index] = { ...newParticipants[index], [field]: value };
    setFormData(prev => ({ ...prev, participants: newParticipants }));
    const errorKey = `participant${index}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    if ((errors as any)[errorKey]) setErrors(prev => ({ ...prev, [errorKey]: '', duplicateEmails: '' }));
  };

  const handleNextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePreviousStep = () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);

    const filledParticipants = formData.participants.filter((p: any, i: number) => i < 4 || (p.firstName && p.lastName && p.email));
    const registrationData = { ...formData, participants: filledParticipants };

    setTimeout(() => {
      setLoading(false);
      console.log('Registration successful:', registrationData);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('societyName', formData.societyName);
      localStorage.setItem('country', formData.country);
      navigate('/portfolio');
    }, 1500);
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', '#dc2626', '#f59e0b', '#3b82f6', '#059669', '#059669'];
    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <div className="auth-container">
      <div className="auth-wrapper society-wrapper">
        <div className="auth-card society-card">
          <div className="auth-header">
            <div className="auth-logo">
              <div className="logo-icon">📈</div>
              <h1>Portfolio Challenge</h1>
            </div>
            <h2>Register Your Society</h2>
            <p>Compete as a team in the European Portfolio Challenge</p>
            <div className="progress-indicator">
              <div className={`progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                <div className="step-number">1</div>
                <div className="step-label">Society Info</div>
              </div>
              <div className="progress-line"></div>
              <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
                <div className="step-number">2</div>
                <div className="step-label">Team Members</div>
              </div>
            </div>
          </div>

          {step === 1 && (
            <form className="auth-form">
              <div className="form-group">
                <label htmlFor="societyName">Society Name *</label>
                <input
                  type="text"
                  id="societyName"
                  name="societyName"
                  value={formData.societyName}
                  onChange={handleChange}
                  className={(errors as any).societyName ? 'error' : ''}
                  placeholder="Investment Society Name"
                  autoComplete="organization"
                />
                {(errors as any).societyName && (
                  <span className="error-message">{(errors as any).societyName}</span>
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
                  className={(errors as any).societyEmail ? 'error' : ''}
                  placeholder="society@university.edu"
                  autoComplete="email"
                />
                {(errors as any).societyEmail && (
                  <span className="error-message">{(errors as any).societyEmail}</span>
                )}
                <p className="field-hint">This email will be used for official communications</p>
              </div>

              <div className="form-group">
                <label htmlFor="country">Country *</label>
                <select
                  id="country"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className={(errors as any).country ? 'error' : ''}
                >
                  <option value="">Select your country</option>
                  {europeanCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
                {(errors as any).country && (
                  <span className="error-message">{(errors as any).country}</span>
                )}
                <p className="field-hint">Only European countries are eligible</p>
              </div>

              <div className="form-group">
                <label htmlFor="password">Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={(errors as any).password ? 'error' : ''}
                    placeholder="Create a strong password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {formData.password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div 
                        className="strength-fill"
                        style={{ 
                          width: `${(passwordStrength.strength / 5) * 100}%`,
                          backgroundColor: passwordStrength.color
                        }}
                      />
                    </div>
                    <span style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </span>
                  </div>
                )}
                {(errors as any).password && (
                  <span className="error-message">{(errors as any).password}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password *</label>
                <div className="password-input-wrapper">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className={(errors as any).confirmPassword ? 'error' : ''}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
                {(errors as any).confirmPassword && (
                  <span className="error-message">{(errors as any).confirmPassword}</span>
                )}
              </div>

              <button 
                type="button"
                onClick={handleNextStep}
                className="btn-primary-auth"
              >
                Continue to Team Members
              </button>

              <div className="auth-footer">
                <p>
                  Already registered?{' '}
                  <Link to="/login" className="auth-link">Sign in</Link>
                </p>
              </div>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="team-section">
                <h3>Team Members</h3>
                <p className="section-description">
                  Enter details for your team members. First 4 are required, last 2 are optional.
                </p>

                {(errors as any).duplicateEmails && (
                  <div className="error-banner">{(errors as any).duplicateEmails}</div>
                )}

                {formData.participants.map((participant: any, index: number) => (
                  <div key={index} className="participant-card">
                    <div className="participant-header">
                      <h4>
                        Participant {index + 1}
                        {index < 4 && <span className="required-badge">Required</span>}
                        {index >= 4 && <span className="optional-badge">Optional</span>}
                      </h4>
                      <label className="captain-radio">
                        <input
                          type="radio"
                          name="captain"
                          checked={formData.captainIndex === index}
                          onChange={() => setFormData((prev: any) => ({ ...prev, captainIndex: index }))}
                          disabled={index >= 4 && !participant.firstName && !participant.lastName}
                        />
                        <span>Captain</span>
                      </label>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label htmlFor={`firstName${index}`}>
                          First Name {index < 4 && '*'}
                        </label>
                        <input
                          type="text"
                          id={`firstName${index}`}
                          value={participant.firstName}
                          onChange={(e) => handleParticipantChange(index, 'firstName', e.target.value)}
                          className={(errors as any)[`participant${index}FirstName`] ? 'error' : ''}
                          placeholder="First name"
                        />
                        {(errors as any)[`participant${index}FirstName`] && (
                          <span className="error-message">{(errors as any)[`participant${index}FirstName`]}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label htmlFor={`lastName${index}`}>
                          Last Name {index < 4 && '*'}
                        </label>
                        <input
                          type="text"
                          id={`lastName${index}`}
                          value={participant.lastName}
                          onChange={(e) => handleParticipantChange(index, 'lastName', e.target.value)}
                          className={(errors as any)[`participant${index}LastName`] ? 'error' : ''}
                          placeholder="Last name"
                        />
                        {(errors as any)[`participant${index}LastName`] && (
                          <span className="error-message">{(errors as any)[`participant${index}LastName`]}</span>
                        )}
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor={`email${index}`}>
                        Email {index < 4 && '*'}
                      </label>
                      <input
                        type="email"
                        id={`email${index}`}
                        value={participant.email}
                        onChange={(e) => handleParticipantChange(index, 'email', e.target.value)}
                        className={(errors as any)[`participant${index}Email`] ? 'error' : ''}
                        placeholder="participant@email.com"
                      />
                      {(errors as any)[`participant${index}Email`] && (
                        <span className="error-message">{(errors as any)[`participant${index}Email`]}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if ((errors as any).terms) setErrors((prev: any) => ({ ...prev, terms: '' }));
                    }}
                  />
                  <span>
                    I agree to the{' '}
                    <Link to="/terms" className="inline-link">Terms of Service</Link>
                    {' '}and{' '}
                    <Link to="/privacy" className="inline-link">Privacy Policy</Link>
                  </span>
                </label>
                {(errors as any).terms && (
                  <span className="error-message">{(errors as any).terms}</span>
                )}
              </div>

              <div className="button-group">
                <button 
                  type="button"
                  onClick={handlePreviousStep}
                  className="btn-secondary-auth"
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  className="btn-primary-auth"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="loading-spinner-small">Registering society...</span>
                  ) : (
                    'Complete Registration'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="auth-sidebar">
          <div className="sidebar-content">
            <h3>European Portfolio Challenge</h3>
            <ul className="feature-list">
              <li>
                <span className="feature-icon">🏆</span>
                <div>
                  <strong>Team Competition</strong>
                  <p>Compete with university societies across Europe</p>
                </div>
              </li>
              <li>
                <span className="feature-icon">👥</span>
                <div>
                  <strong>Collaborative Trading</strong>
                  <p>Work together as a team of 4-6 members</p>
                </div>
              </li>
              <li>
                <span className="feature-icon">📊</span>
                <div>
                  <strong>Real-Time Analytics</strong>
                  <p>Track performance with professional tools</p>
                </div>
              </li>
              <li>
                <span className="feature-icon">🎓</span>
                <div>
                  <strong>Learn & Network</strong>
                  <p>Gain experience and connect with peers</p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
