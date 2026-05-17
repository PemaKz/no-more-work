/**
 * Crea una notificación para un usuario. No-op silencioso si faltan datos o
 * si el modelo no está cargado — las notificaciones no deben tumbar la
 * operación principal que las dispara.
 *
 * Uso típico desde una ruta:
 *   await notify(container, {
 *     userId: request.user.id,
 *     organizationId: request.activeOrganizationId,
 *     type: 'zone_created',
 *     title: 'Zona creada',
 *     body: `Has creado la zona "${name}".`,
 *   });
 */
const { emitToUser } = require('./realtime');

async function notify(
  container,
  { userId, organizationId, type = 'info', title, body, link } = {}
) {
  if (!userId || !organizationId || !title) return null;
  try {
    const { Notification } = container.get('database').models;
    if (!Notification) return null;
    const notification = await Notification.create({
      userId,
      organizationId,
      type,
      title,
      body: body || null,
      link: link || null,
    });
    emitToUser(container, userId, 'notification:created', notification.toJSON());
    return notification;
  } catch (err) {
    try {
      container.get('logger')?.warn(
        '[notify] failed to create notification:',
        err?.message
      );
    } catch {
      // silent
    }
    return null;
  }
}

module.exports = { notify };

