const { Middleware } = require('zyket');
const { fromNodeHeaders } = require('better-auth/node');

/**
 * Verifica que el request lleve una sesión válida de better-auth y, opcionalmente,
 * que el usuario tenga una organización activa. Inyecta en `request`:
 *   - session: el objeto de sesión completo
 *   - user: el usuario logueado
 *   - activeOrganizationId: id de la org activa (puede ser null)
 *
 * Uso:
 *   middlewares = {
 *     post: [ new AuthMiddleware({ requireOrg: true }) ]
 *   }
 */
module.exports = class AuthMiddleware extends Middleware {
  #requireOrg;

  constructor({ requireOrg = false } = {}) {
    super();
    this.#requireOrg = requireOrg;
  }

  async handle({ container, request, response, next }) {
    const auth = container.get('auth');
    const headers = fromNodeHeaders(request.headers);

    const session = await auth.client.api.getSession({ headers });

    if (!session?.user) {
      return response
        .status(401)
        .json({ success: false, message: 'Unauthorized' });
    }

    request.session = session;
    request.user = session.user;
    request.activeOrganizationId =
      session.session?.activeOrganizationId || null;

    if (this.#requireOrg && !request.activeOrganizationId) {
      return response.status(400).json({
        success: false,
        message: 'No active organization. Select one before continuing.',
      });
    }

    next();
  }
};
