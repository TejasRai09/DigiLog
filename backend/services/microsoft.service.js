const axios = require('axios');

/**
 * Exchange a Microsoft access token for user profile via Graph API.
 * Returns { microsoftId, email, name }.
 */
const getMicrosoftUserProfile = async (accessToken) => {
  const { data } = await axios.get('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  return {
    microsoftId: data.id,
    email: (data.mail || data.userPrincipalName || '').toLowerCase(),
    name: data.displayName || data.givenName || 'Unknown',
  };
};

module.exports = { getMicrosoftUserProfile };
