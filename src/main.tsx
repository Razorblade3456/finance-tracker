import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import { GoogleOAuthProvider } from '@react-oauth/google';

const CLIENT_ID = "79775733699-m2t6l70fngeo69s4qjo5pmnoqo8enccm.apps.googleusercontent.com"

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
<React.StrictMode>
  <GoogleOAuthProvider clientId={'CLIENT_ID'}>
    <App />
  </GoogleOAuthProvider>
</React.StrictMode>
);
