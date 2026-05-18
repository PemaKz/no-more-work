const { encrypt, decrypt } = require('./crypto');

/**
 * Crea o actualiza el OrgSecret interno asociado a un Provider para
 * almacenar su API key. El secret tiene `internal=true` y por tanto no
 * aparece en el listado de Secrets del Config — vive detrás del Provider.
 *
 * Devuelve el provider con `apiKeySecretId` actualizado.
 */
async function setProviderApiKey(container, provider, plaintext, transaction = null) {
  if (plaintext == null || plaintext === '') return provider;
  const { OrgSecret } = container.get('database').models;

  if (provider.apiKeySecretId) {
    const existing = await OrgSecret.findOne({
      where: {
        id: provider.apiKeySecretId,
        organizationId: provider.organizationId,
      },
      transaction,
    });
    if (existing) {
      await existing.update(
        { valueEncrypted: encrypt(plaintext) },
        { transaction }
      );
      return provider;
    }
    // El secret referenciado ya no existe — caemos a crear uno nuevo
  }

  const secret = await OrgSecret.create(
    {
      organizationId: provider.organizationId,
      key: `__PROVIDER_${provider.id}_KEY`,
      valueEncrypted: encrypt(plaintext),
      description: `API key for provider ${provider.name}`,
      internal: true,
    },
    { transaction }
  );
  await provider.update({ apiKeySecretId: secret.id }, { transaction });
  return provider;
}

/**
 * Borra el OrgSecret asociado a un Provider (solo si es internal — los
 * gestionados por el usuario los respetamos).
 */
async function clearProviderApiKey(container, provider, transaction = null) {
  if (!provider.apiKeySecretId) return;
  const { OrgSecret } = container.get('database').models;
  const secret = await OrgSecret.findOne({
    where: { id: provider.apiKeySecretId },
    transaction,
  });
  if (secret && secret.internal) {
    await secret.destroy({ transaction });
  }
  await provider.update({ apiKeySecretId: null }, { transaction });
}

/**
 * Resuelve el API key en plaintext de un provider. Solo para uso
 * server-side (engine runtime).
 */
async function resolveProviderApiKey(container, provider) {
  if (!provider.apiKeySecretId) return null;
  const { OrgSecret } = container.get('database').models;
  const secret = await OrgSecret.findOne({
    where: { id: provider.apiKeySecretId },
  });
  if (!secret) return null;
  return decrypt(secret.valueEncrypted);
}

module.exports = {
  setProviderApiKey,
  clearProviderApiKey,
  resolveProviderApiKey,
};
