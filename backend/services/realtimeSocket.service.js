const { Server } = require('socket.io');
const { verifyToken } = require('../utils/jwt');
const { pool } = require('../config/mysql');
const { CLIENT_ORIGIN } = require('../config/env');
const { setIo, userRoom } = require('./realtime.service');

/**
 * Attach Socket.IO to an http.Server and authenticate sockets with DigiLog JWT.
 * @param {import('http').Server} httpServer
 */
function attachRealtime(httpServer) {
  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: CLIENT_ORIGIN,
      credentials: true,
    },
  });

  setIo(io);

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '').trim();
      if (!token) {
        return next(new Error('No token provided.'));
      }
      const decoded = verifyToken(token);
      const [rows] = await pool.query(
        `SELECT id, is_active FROM users WHERE id = ? LIMIT 1`,
        [decoded.id],
      );
      const row = rows[0];
      if (!row) return next(new Error('User not found.'));
      if (!row.is_active) return next(new Error('Account is deactivated.'));
      socket.userId = Number(row.id);
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired token.'));
    }
  });

  io.on('connection', (socket) => {
    const uid = socket.userId;
    if (!uid) {
      socket.disconnect(true);
      return;
    }
    socket.join(userRoom(uid));
    socket.on('disconnect', () => {
      /* room leave is automatic */
    });
  });

  return io;
}

module.exports = { attachRealtime };
