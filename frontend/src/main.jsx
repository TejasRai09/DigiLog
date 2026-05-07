import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { Toaster } from 'react-hot-toast';

import { msalInstance } from './msalConfig';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{ duration: 3500, style: { fontSize: '0.875rem' } }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const render = () => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    msalInstance ? <MsalProvider instance={msalInstance}>{app}</MsalProvider> : app
  );
};

// MSAL v3 requires initialize() before use; skip entirely on HTTP (no crypto)
if (msalInstance) {
  msalInstance.initialize().then(render);
} else {
  render();
}
