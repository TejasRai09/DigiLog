const axios = require('axios');
const { OAuth2Client } = require('google-auth-library');
const { GOOGLE_CLIENT_ID } = require('../config/env');

let _client;

const getClient = () => {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Sign-In is not configured on the server.');
  }
  if (!_client) _client = new OAuth2Client(GOOGLE_CLIENT_ID);
  return _client;
};

/**
 * Verify a Google ID token (from GIS) and return profile fields.
 * @returns {{ googleId: string, email: string, name: string }}
 */
const verifyGoogleIdToken = async (idToken) => {
  const ticket = await getClient().verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error('Invalid Google token.');
  if (payload.email_verified === false) throw new Error('Google email is not verified.');
  const email = (payload.email || '').toLowerCase();
  if (!email) throw new Error('Could not retrieve email from Google.');

  return {
    googleId: payload.sub,
    email,
    name: payload.name || payload.given_name || 'Unknown',
  };
};

/**
 * Exchange a Google access token for user profile via OAuth userinfo API.
 * @returns {{ googleId: string, email: string, name: string }}
 */
const getGoogleUserProfile = async (accessToken) => {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const email = (data.email || '').toLowerCase();
  if (!email) throw new Error('Could not retrieve email from Google.');

  return {
    googleId: data.sub,
    email,
    name: data.name || 'Unknown',
  };
};

module.exports = { verifyGoogleIdToken, getGoogleUserProfile };
