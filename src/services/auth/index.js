const { AuthService } = require('zyket');
const { createAuthMiddleware } = require('better-auth/api');

const DEFAULT_ORGANIZATION = {
  name: 'No More Work',
  slug: 'no-more-work',
};

/**
 * Idempotente: asegura que exista la organización por defecto y que el usuario
 * sea miembro. El primer usuario que entra crea la org como `owner`; los
 * siguientes se añaden como `member`.
 */
async function ensureDefaultOrganizationMembership(ctx, userId) {
  const adapter = ctx.context.adapter;

  let organization = await adapter.findOne({
    model: 'organization',
    where: [{ field: 'slug', value: DEFAULT_ORGANIZATION.slug }],
  });

  let role = 'member';
  if (!organization) {
    organization = await adapter.create({
      model: 'organization',
      data: {
        name: DEFAULT_ORGANIZATION.name,
        slug: DEFAULT_ORGANIZATION.slug,
        createdAt: new Date(),
      },
    });
    role = 'owner';
  }

  const existingMembership = await adapter.findOne({
    model: 'member',
    where: [
      { field: 'userId', value: userId },
      { field: 'organizationId', value: organization.id },
    ],
  });

  if (existingMembership) return { organization, created: false };

  await adapter.create({
    model: 'member',
    data: {
      userId,
      organizationId: organization.id,
      role,
      createdAt: new Date(),
    },
  });

  return { organization, created: true, role };
}

module.exports = class CustomAuthService extends AuthService {
  #container;
  client;

  constructor(container) {
    super(container);
    this.#container = container;
  }

  get userAdditionalFields() {
  }

  get organizationAdditionalFields() {
  }

  get hooks() {
    return {
      after: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/sign-in/email') return;

        const userId = ctx.context.newSession?.user?.id;
        if (!userId) return;

        try {
          const result = await ensureDefaultOrganizationMembership(ctx, userId);
          if (result?.created) {
            ctx.context.logger?.info?.(
              `[auth] user ${userId} added to "${DEFAULT_ORGANIZATION.name}" as ${result.role}`
            );
          }
        } catch (err) {
          ctx.context.logger?.error?.(
            '[auth] failed to ensure default organization membership',
            err
          );
        }
      }),
    };
  }

  async sendResetPasswordEmail({ user, url, token }, request) {
    throw new Error("sendResetPasswordEmail method not implemented");
  }

  async sendVerificationEmail({ user, url, token }, request) {
    throw new Error("sendVerificationEmail method not implemented");
  }

  async sendInvitationEmail(data) {
    throw new Error("sendInvitationEmail method not implemented");
  }

  async allowUserToCreateOrganization(user) {
    return true;
  }
}
