import { PublicClientApplication, LogLevel } from '@azure/msal-browser';

export const msalConfig = {
  auth: {
    clientId:              import.meta.env.VITE_AZURE_CLIENT_ID  || '',
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

// Scopes requested from Microsoft
export const loginRequest = {
  scopes: ['openid', 'profile', 'email', 'User.Read'],
};

// Singleton instance shared across the app
export const msalInstance = new PublicClientApplication(msalConfig);
