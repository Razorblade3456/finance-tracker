export {};

declare module './landing.jsx' {
  import type { FC } from 'react';

  interface LandingProps {
    isDarkMode: boolean;
    onToggleTheme: () => void;
    onGoogleCredential: (credential: string) => void;
  }

  const Landing: FC<LandingProps>;
  export default Landing;
}
