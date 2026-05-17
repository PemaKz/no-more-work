const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');

const MAX_NOTIFICATIONS = 50;

module.exports = class NotificationsRoute extends Route {
  middlewares = {
    get: [new AuthMiddleware({ requireOrg: true })],
  };

  async get({ container, request }) {
    const { Notification } = container.get('database').models;
    const rows = await Notification.findAll({
      where: {
        userId: request.user.id,
        organizationId: request.activeOrganizationId,
      },
      order: [['createdAt', 'DESC']],
      limit: MAX_NOTIFICATIONS,
    });
    return { notifications: rows.map((r) => r.toJSON()) };
  }
};
