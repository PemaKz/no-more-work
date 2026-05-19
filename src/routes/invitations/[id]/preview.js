const { Route } = require('zyket');

// Endpoint público (sin auth) que devuelve datos mínimos de una invitación
// para que la vista /invitation/:id pueda mostrar y autorrellenar el email
// del destinatario en los forms de login/signup ANTES de tener sesión.
// La validación real (que el email coincida, que sea válida, etc.) la
// sigue haciendo Better Auth en /organization/get-invitation y
// /organization/accept-invitation. Aquí solo exponemos lo necesario para
// la UX, sin info sensible.
module.exports = class InvitationPreviewRoute extends Route {
  middlewares = {};

  async get({ container, request }) {
    const id = request.params?.id;
    if (!id || typeof id !== 'string') {
      return { status: 400, success: false, message: 'invitation id required' };
    }

    const { sequelize } = container.get('database');
    const [rows] = await sequelize.query(
      `SELECT i."id", i."email", i."role", i."status", i."expiresAt",
              o."name" AS "organizationName", o."slug" AS "organizationSlug"
         FROM "invitation" i
         JOIN "organization" o ON o."id" = i."organizationId"
        WHERE i."id" = :id
        LIMIT 1`,
      { replacements: { id } }
    );

    const inv = rows?.[0];
    if (!inv) {
      return { status: 404, success: false, message: 'invitation not found' };
    }
    if (inv.status !== 'pending') {
      return {
        status: 410,
        success: false,
        message: `invitation ${inv.status}`,
      };
    }
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) {
      return { status: 410, success: false, message: 'invitation expired' };
    }

    return {
      invitation: {
        id: inv.id,
        email: inv.email,
        role: inv.role,
        organizationName: inv.organizationName,
        organizationSlug: inv.organizationSlug,
        expiresAt: inv.expiresAt,
      },
    };
  }
};
