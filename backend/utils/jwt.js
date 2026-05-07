const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

const SECRET = JWT_SECRET;
const EXPIRES_IN = JWT_EXPIRES_IN;

const signToken = (payload) => jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });

const verifyToken = (token) => jwt.verify(token, SECRET);

module.exports = { signToken, verifyToken };
