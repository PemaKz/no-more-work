/**
 * Helpers para emitir eventos a rooms de socket.io.
 *
 * Silenciosos si el servicio socketio no está cargado (p.ej. DISABLE_SOCKET=true)
 * o si la room destino es vacía — la mutación REST funciona igual aunque el
 * realtime falle.
 */
function getSocketServer(container) {
  try {
    if (typeof container?.has === 'function' && !container.has('socketio')) {
      return null;
    }
    return container.get('socketio');
  } catch {
    return null;
  }
}

function emitToOrg(container, orgId, event, data) {
  if (!orgId || !event) return;
  const svc = getSocketServer(container);
  try {
    svc?.io?.to(`org:${orgId}`).emit(event, data);
  } catch {
    // silent
  }
}

function emitToUser(container, userId, event, data) {
  if (!userId || !event) return;
  const svc = getSocketServer(container);
  try {
    svc?.io?.to(`user:${userId}`).emit(event, data);
  } catch {
    // silent
  }
}

module.exports = { emitToOrg, emitToUser };
