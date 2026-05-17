const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');

module.exports = class NotificationRoute extends Route {
  middlewares = {
    put: [new AuthMiddleware({ requireOrg: true })],
    delete: [new AuthMiddleware({ requireOrg: true })],
  };

  async put({ container, request }) {
    const { Notification } = container.get('database').models;
    const id = request.params.id;
    const notif = await Notification.findOne({
      where: {
        id,
        userId: request.user.id,
        organizationId: request.activeOrganizationId,
      },
    });
    if (!notif) {
      return { status: 404, success: false, message: 'Notification not found' };
    }
    const body = request.body || {};
    const updates = {};
    if (typeof body.read === 'boolean') updates.read = body.read;
    if (Object.keys(updates).length === 0) {
      return { status: 400, success: false, message: 'Nothing to update' };
    }
    await notif.update(updates);
    return { notification: notif.toJSON() };
  }

  async delete({ container, request }) {
    const { Notification } = container.get('database').models;
    const id = request.params.id;
    const notif = await Notification.findOne({
      where: {
        id,
        userId: request.user.id,
        organizationId: request.activeOrganizationId,
      },
    });
    if (!notif) {
      return { status: 404, success: false, message: 'Notification not found' };
    }
    await notif.destroy();
    return { id };
  }
};
