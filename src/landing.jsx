import React from 'react';
import { GoogleSignInButton } from './components/GoogleSignInButton';

const Landing = ({ isDarkMode, onToggleTheme, onGoogleCredential }) => {
  const themeLabel = isDarkMode ? 'Switch to light mode' : 'Switch to dark mode';
  const themeIcon = isDarkMode ? '🌙' : '🌞';

  return (
    <div className="landing">
      <div className="landing__surface">
        <div className="landing__top">
          <div className="landing__brand">
            <span className="logo-badge">FL</span>
            <div className="landing__intro">
              <p className="landing__eyebrow">Welcome to Flow Ledger</p>
              <h1 className="landing__title">Sign in with Google to get started.</h1>
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
          Connect your Google account now. Once the secure sync launches, your spending and notes
          will follow you automatically.
        </p>
        <div className="landing__actions">
          <GoogleSignInButton
            onCredential={onGoogleCredential}
            theme={isDarkMode ? 'dark' : 'light'}
          />
          <p className="landing__note">
            We’ll log you straight into the dashboard after Google confirms your account.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
