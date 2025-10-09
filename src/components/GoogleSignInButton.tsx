import { useEffect, useMemo, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID } from '../config/googleClient';

type GsiButtonConfiguration = {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  logo_alignment?: 'left' | 'center';
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: GsiButtonConfiguration) => void;
          prompt: () => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const scriptId = 'google-identity-services';

const ensureGoogleIdentityScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google sign-in is only available in the browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (existingScript && existingScript.dataset.loaded === 'true') {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google identity script.')), {
        once: true
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.id = scriptId;
    script.dataset.loaded = 'false';
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    });
    script.addEventListener('error', () => {
      reject(new Error('Failed to load Google identity script.'));
    });
    document.head.appendChild(script);
  });
};

export type GoogleSignInStatus = 'idle' | 'loading' | 'ready' | 'error';

interface GoogleSignInButtonProps {
  onCredential: (credential: string) => void;
  theme: 'light' | 'dark';
}

export const GoogleSignInButton = ({ onCredential, theme }: GoogleSignInButtonProps) => {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<GoogleSignInStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clientId = useMemo(() => {
    const envClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
    const fallbackClientId = (GOOGLE_CLIENT_ID ?? '').trim();
    return envClientId || fallbackClientId;
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (!clientId) {
      setStatus('error');
      setErrorMessage(
        'Add a VITE_GOOGLE_CLIENT_ID in your environment or update src/config/googleClient.ts with your client ID to enable Google sign-in.'
      );
      return () => {
        isMounted = false;
      };
    }

    setStatus('loading');
    ensureGoogleIdentityScript()
      .then(() => {
        if (!isMounted) {
          return;
        }
        if (!window.google?.accounts?.id) {
          setStatus('error');
          setErrorMessage('Google identity script loaded, but the library was not found.');
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) {
              onCredential(response.credential);
            }
          }
        });

        if (buttonRef.current) {
          buttonRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(buttonRef.current, {
            type: 'standard',
            theme: theme === 'dark' ? 'filled_black' : 'outline',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            logo_alignment: 'left'
          });
        }

        window.google.accounts.id.prompt();
        setStatus('ready');
        setErrorMessage(null);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'Unable to load Google sign-in.');
      });

    return () => {
      isMounted = false;
    };
  }, [clientId, onCredential, theme]);

  useEffect(() => {
    if (status !== 'ready' || !clientId || !window.google?.accounts?.id || !buttonRef.current) {
      return;
    }

    buttonRef.current.innerHTML = '';
    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: theme === 'dark' ? 'filled_black' : 'outline',
      size: 'large',
      shape: 'pill',
      text: 'signin_with',
      logo_alignment: 'left'
    });
  }, [status, theme, clientId]);

  useEffect(() => {
    if (status === 'error' && errorMessage) {
      console.error('Google sign-in failed:', errorMessage);
    }
  }, [status, errorMessage]);

  if (status === 'error') {
    return (
      <div className="google-auth google-auth--error" role="alert">
        <p>{errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="google-auth" data-status={status}>
      <div ref={buttonRef} className="google-auth__button" />
    </div>
  );
};
