import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId:              import.meta.env.VITE_AZURE_CLIENT_ID  || 'disabled',
    authority:             `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || 'common'}`,
    redirectUri:           import.meta.env.VITE_REDIRECT_URI     || window.location.origin,
    postLogoutRedirectUri: import.meta.env.VITE_REDIRECT_URI     || window.location.origin,
    navigateToLoginRequestUrl: false,
  },
  cache: {
    cacheLocation:        'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel:         LogLevel.Warning,
      loggerCallback:   (level, message) => console.warn('[MSAL]', level, message),
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// MSAL requires window.crypto.subtle which is only available over HTTPS.
// On plain HTTP (e.g. IP-based deployment) we export null and skip MsalProvider.
const cryptoAvailable = (() => {
  try { return !!(window.crypto && window.crypto.subtle); } catch { return false; }
})();

export const msalInstance = cryptoAvailable
  ? new PublicClientApplication(msalConfig)
  : null;
