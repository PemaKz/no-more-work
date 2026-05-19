const { createAnthropic } = require('@ai-sdk/anthropic');
const { createOpenAI } = require('@ai-sdk/openai');
const { createOpenAICompatible } = require('@ai-sdk/openai-compatible');
const { resolveProviderApiKey } = require('../../../utils/providerSecrets');

/**
 * Devuelve un LanguageModel del Vercel AI SDK configurado según el Provider.
 * Resuelve la API key del OrgSecret asociado en runtime — nunca expone el
 * valor fuera del servidor.
 *
 * Si quieres añadir un nuevo `kind` de provider, basta con un nuevo `case`
 * aquí y el modelo correspondiente del AI SDK; el resto del engine no
 * necesita saber nada.
 */
async function getLLM(provider, container) {
  if (!provider) throw new Error('Provider is required');

  const apiKey = await resolveProviderApiKey(container, provider);

  switch (provider.kind) {
    case 'anthropic': {
      if (!apiKey) throw new Error('Anthropic provider requires an API key');
      return createAnthropic({ apiKey })(provider.defaultModel);
    }
    case 'openai': {
      if (!apiKey) throw new Error('OpenAI provider requires an API key');
      return createOpenAI({ apiKey })(provider.defaultModel);
    }
    case 'openai_compatible': {
      if (!provider.baseURL) {
        throw new Error('openai_compatible provider requires baseURL');
      }
      return createOpenAICompatible({
        name: provider.name || 'openai-compat',
        baseURL: provider.baseURL,
        apiKey: apiKey || undefined,
      })(provider.defaultModel);
    }
    default:
      throw new Error(`Unknown provider kind: ${provider.kind}`);
  }
}

module.exports = { getLLM };
