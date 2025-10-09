import React from 'react';

const Landing = ({
  displayName,
  onContinue,
  onSignOut,
  isDarkMode,
  onToggleTheme
}) => {
  const themeLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
  const themeIcon = isDarkMode ? '🌙' : '🌞';
  const greetingName = displayName?.trim() ? displayName : 'there';

  return (
    <div className="landing">
      <div className="landing__surface">
        <div className="landing__top">
          <div className="landing__brand">
            <span className="logo-badge">FL</span>
            <div className="landing__intro">
              <p className="landing__eyebrow">Signed in with Google</p>
              <h1 className="landing__title">Welcome back, {greetingName}.</h1>
            </div>
          </div>
          <button
            type="button"
            className="theme-toggle landing__theme-toggle"
            onClick={onToggleTheme}
            aria-pressed={isDarkMode}
            aria-label={themeLabel}
          >
            <span className="theme-toggle__icon" aria-hidden="true">
              {themeIcon}
            </span>
            <span className="theme-toggle__label">{isDarkMode ? 'Light mode' : 'Dark mode'}</span>
          </button>
        </div>
        <p className="landing__message">
          Your Flow Ledger preview is ready. Take a quick look around while we finish the live sync
          connection.
        </p>
        <div className="landing__actions">
          <button type="button" className="landing__primary" onClick={onContinue}>
            Enter dashboard
          </button>
          <button type="button" className="landing__secondary" onClick={onSignOut}>
            Sign out
          </button>
        </div>
        <p className="landing__note">
          Once the database launches, your spending, savings, and pinned notes will follow you here
          automatically.
        </p>
      </div>
    </div>
  );
};

export default Landing;
