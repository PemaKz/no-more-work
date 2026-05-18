const { createAnthropic } = require('@ai-sdk/anthropic');
const { createOpenAI } = require('@ai-sdk/openai');
const { createOpenAICompatible } = require('@ai-sdk/openai-compatible');
const { resolveProviderApiKey } = require('../utils/providerSecrets');

/**
 * Devuelve un LanguageModel del Vercel AI SDK configurado según el Provider.
 * Resuelve la API key del OrgSecret asociado en runtime — nunca expone el
 * valor fuera de este servidor.
 *
 * Lanza Error si el provider no es válido o falta API key cuando es
 * obligatoria (anthropic/openai requieren key; openai_compatible puede
 * funcionar sin ella en setups locales tipo Ollama).
 */
async function getLLM(provider, container) {
  if (!provider) throw new Error('Provider is required');

  const apiKey = await resolveProviderApiKey(container, provider);

  switch (provider.kind) {
    case 'anthropic': {
      if (!apiKey) {
        throw new Error('Anthropic provider requires an API key');
      }
      const client = createAnthropic({ apiKey });
      return client(provider.defaultModel);
    }

    case 'openai': {
      if (!apiKey) {
        throw new Error('OpenAI provider requires an API key');
      }
      const client = createOpenAI({ apiKey });
      return client(provider.defaultModel);
    }

    case 'openai_compatible': {
      if (!provider.baseURL) {
        throw new Error('openai_compatible provider requires baseURL');
      }
      const client = createOpenAICompatible({
        name: provider.name || 'openai-compat',
        baseURL: provider.baseURL,
        // apiKey opcional — Ollama local p.ej. no la pide
        apiKey: apiKey || undefined,
      });
      return client(provider.defaultModel);
    }

    default:
      throw new Error(`Unknown provider kind: ${provider.kind}`);
  }
}

module.exports = { getLLM };
