const { Handler } = require('zyket');

/**
 * Connection handler. Hace auth INLINE (no via guards) porque zyket
 * no await los guards de conexión — si tiraran async-throw, el connection
 * handler se ejecutaría igual. Aquí, un throw es atrapado por el wrapper
 * y dispara `socket.disconnect()`.
 *
 * Flujo:
 *  1. Lee `socket.handshake.auth.token` (sesión de better-auth)
 *  2. Resuelve la sesión via bearer header
 *  3. Si no es válida, throw → disconnect
 *  4. Rellena socket.data.{user, session, organizationId}
 *  5. Joinea las rooms `user:<id>` (notificaciones) y `org:<id>` (mapa)
 */
module.exports = class ConnectionHandler extends Handler {
  async handle({ container, socket }) {
    const token = socket.handshake?.auth?.token;
    if (!token) {
      throw new Error('Missing auth token');
    }

    const auth = container.get('auth');
    const session = await auth.client.api.getSession({
      headers: new Headers({ Authorization: `Bearer ${token}` }),
    });

    if (!session?.user) {
      throw new Error('Invalid session');
    }

    const orgId = session.session?.activeOrganizationId || null;

    socket.data = socket.data || {};
    socket.data.user = session.user;
    socket.data.session = session.session;
    socket.data.organizationId = orgId;

    // Notificaciones — por usuario
    socket.join(`user:${session.user.id}`);
    // Mapa/zonas/agentes — por organización activa
    if (orgId) socket.join(`org:${orgId}`);

    container.get('logger').info(
      `[socket] connected user=${session.user.id} org=${orgId || 'none'} sid=${socket.id}`
    );

    socket.on('disconnect', (reason) => {
      container
        .get('logger')
        .debug(`[socket] disconnected sid=${socket.id} reason=${reason}`);
    });
  }
};
