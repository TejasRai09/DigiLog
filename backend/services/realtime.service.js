/**
 * Socket.IO realtime helpers for DigiLog.
 * Rooms: user:{userId}
 */
let io = null;

function setIo(instance) {
  io = instance || null;
}

function getIo() {
  return io;
}

function userRoom(userId) {
  return `user:${Number(userId)}`;
}

/**
 * Emit an event to all sockets for a user. Never throws.
 */
function emitToUser(userId, event, payload) {
  try {
    const uid = Number(userId);
    if (!io || !uid || !event) return;
    io.to(userRoom(uid)).emit(event, payload);
  } catch (err) {
    console.error('[realtime] emitToUser failed:', err.message);
  }
}

module.exports = {
  setIo,
  getIo,
  userRoom,
  emitToUser,
  EVENT_NOTIFICATION_NEW: 'notification:new',
};
