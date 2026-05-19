const { AuthService } = require('zyket');
const { betterAuth } = require('better-auth');
const { admin, bearer, organization } = require('better-auth/plugins');
const { Pool } = require('pg');
const path = require('path');

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

  async sendResetPasswordEmail({ user, url, token }, request) {
    throw new Error("sendResetPasswordEmail method not implemented");
  }

  async sendVerificationEmail({ user, url, token }, request) {
    throw new Error("sendVerificationEmail method not implemented");
  }

  async sendInvitationEmail(data) {
    // Sin SMTP configurado: solo logueamos el link. El frontend lo muestra
    // copiable al admin tras invitar (la respuesta del POST devuelve la
    // invitación con su id). Cuando se integre SMTP, sustituir aquí.
    const base =
      process.env.FRONTEND_URL ||
      process.env.TRUSTED_ORIGINS?.split(',')[0] ||
      'http://localhost:5173';
    const url = `${base.replace(/\/$/, '')}/invitation/${data.id}`;
    const logger = this.#container?.get?.('logger');
    const line = `[invite] ${data.email} → ${data.organization?.name || data.organization?.slug || '?'} (role=${data.role}): ${url}`;
    if (logger?.info) logger.info(line);
    else console.log(line);
  }

  async allowUserToCreateOrganization(user) {
    return true;
  }

  // Override del getter `auth` de zyket porque necesitamos pasar
  // `requireEmailVerificationOnInvitation: false` al plugin organization
  // (este proyecto no verifica email, así que de lo contrario nadie podría
  // aceptar/rechazar invitaciones). Mantengo el resto de la configuración
  // base sincronizada con node_modules/zyket/src/services/auth/index.js.
  get auth() {
    const cache = this.#container.get('cache');
    return betterAuth({
      hooks: this.hooks,
      plugins: [
        admin(),
        bearer(),
        organization({
          requireEmailVerificationOnInvitation: false,
          schema: {
            organization: {
              additionalFields: this.organizationAdditionalFields,
            },
            member: {
              additionalFields: this.memberAdditionalFields,
            },
          },
          allowUserToCreateOrganization: async (user) =>
            this.allowUserToCreateOrganization(user),
          sendInvitationEmail: async (data) => this.sendInvitationEmail(data),
        }),
        ...this.plugins,
      ],
      socialProviders: this.socialProviders,
      database: this.#getDatabaseConnection(),
      advanced: {
        crossSubDomainCookies: { enabled: true },
        cookie: {
          sameSite: 'none',
          secure: true,
          path: '/',
          state: { attributes: { sameSite: 'none', secure: true } },
        },
        defaultCookieAttributes: { secure: true, sameSite: 'none' },
        cookies: {
          state: { attributes: { sameSite: 'none', secure: true } },
        },
      },
      secondaryStorage: {
        get: async (key) => cache.get(key),
        set: async (key, value, ttl) => {
          await cache.set(key, value);
          if (ttl) await cache.expire(key, ttl);
        },
        delete: async (key) => cache.del(key),
      },
      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        sendResetPassword: async ({ user, url, token }, request) =>
          this.sendResetPasswordEmail({ user, url, token }, request),
      },
      emailVerification: {
        sendVerificationEmail: async ({ user, url, token }, request) =>
          this.sendVerificationEmail({ user, url, token }, request),
        sendOnSignIn: false,
        autoSignInAfterVerification: true,
      },
      user: { additionalFields: this.userAdditionalFields },
      account: { accountLinking: { enabled: true }, skipStateCookieCheck: true },
      session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      secret: process.env.AUTH_SECRET || 'your-secret-key-change-in-production',
      trustedOrigins:
        process.env.TRUSTED_ORIGINS?.split(',') || [
          'http://localhost:5173',
          'http://localhost:6632',
        ],
    });
  }

  #getDatabaseConnection() {
    const dialect = process.env.DATABASE_DIALECT;
    if (dialect === 'sqlite') {
      const Database = require('better-sqlite3');
      const dbPath =
        process.env.DATABASE_URL || path.join(process.cwd(), 'database.sqlite');
      return new Database(dbPath);
    }
    if (dialect === 'postgresql') {
      return new Pool({ connectionString: process.env.DATABASE_URL || null });
    }
    throw new Error(`Unsupported database dialect: ${dialect}`);
  }
};
