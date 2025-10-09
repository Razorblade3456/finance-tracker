import type { FC } from 'react';

export interface LandingThemeOverrides {
  [token: string]: string | undefined;
}

export interface LandingProps {
  /**
   * Customize the color tokens used by the landing experience.
   * Provide a map of token name to color value (CSS color string).
   */
  theme?: LandingThemeOverrides;
  /**
   * Optional overrides applied when rendering in dark mode.
   */
  themeDark?: LandingThemeOverrides;
  /**
   * Handler invoked when the Google Identity Services widget returns a credential response.
   */
  onGoogleCredential: (credential: string) => void;
}

export declare const Landing: FC<LandingProps>;