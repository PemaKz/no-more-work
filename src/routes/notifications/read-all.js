const { Route } = require('zyket');
const AuthMiddleware = require('../../middlewares/auth');

module.exports = class NotificationsReadAllRoute extends Route {
  middlewares = {
    post: [new AuthMiddleware({ requireOrg: true })],
  };

  async post({ container, request }) {
    const { Notification } = container.get('database').models;
    const [updated] = await Notification.update(
      { read: true },
      {
        where: {
          userId: request.user.id,
          organizationId: request.activeOrganizationId,
          read: false,
        },
      }
    );
    return { updated };
  }
};
