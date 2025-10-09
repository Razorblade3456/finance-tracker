export {};

declare module './landing.jsx' {
  import type { FC } from 'react';

  interface LandingProps {
    displayName?: string;
    onContinue: () => void;
    onSignOut: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
  }

  const Landing: FC<LandingProps>;
  export default Landing;
}
