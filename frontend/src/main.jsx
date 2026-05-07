import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { Toaster } from 'react-hot-toast';

import { msalInstance } from './msalConfig';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// MSAL v3 requires initialize() before any API calls (including handleRedirectPromise)
msalInstance.initialize().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <BrowserRouter>
          <AuthProvider>
            <App />
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3500,
                style: { fontSize: '0.875rem' },
              }}
            />
          </AuthProvider>
        </BrowserRouter>
      </MsalProvider>
    </React.StrictMode>
  );
});
