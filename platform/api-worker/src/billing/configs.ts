/**
 * Static integration pricing configurations.
 * Subset ported from Miyagi3's IntegrationConfigs.ts — AI text, AI image, web search only.
 */

export interface IntegrationConfig {
  integrationName: string
  endpoint: string
  billingModel: 'per_request' | 'per_second' | 'per_token' | 'per_pixel'
  baseCostPerUnit: number
  currency: string
  costModifiers?: {
    baseMultipliers?: Record<string, Record<string, number>>
    unitCalculation?: {
      formula?: string
      minUnits?: number
      roundUp?: boolean
    }
  }
  isActive: boolean
}

export const INTEGRATION_CONFIGS: Record<string, IntegrationConfig> = {
  // ---- AI Text Generation (OpenAI) ---- per-token billing
  'openai/chat-completion': {
    integrationName: 'openai',
    endpoint: 'chat-completion',
    billingModel: 'per_token',
    baseCostPerUnit: 0.00003, // ~$0.03/1K tokens (GPT-4o class)
    currency: 'USD',
    costModifiers: {
      baseMultipliers: {
        model: {
          'gpt-4o': 1.0,
          'gpt-4o-mini': 0.1,
          'gpt-4.1': 1.0,
          'gpt-4.1-mini': 0.13,
          'gpt-4.1-nano': 0.033,
        },
      },
    },
    isActive: true,
  },

  // ---- AI Image Generation (Freepik text-to-image) ---- per-request billing
  'freepik/text-to-image-classic': {
    integrationName: 'freepik',
    endpoint: 'text-to-image-classic',
    billingModel: 'per_request',
    baseCostPerUnit: 0.005,
    currency: 'USD',
    costModifiers: {
      unitCalculation: { formula: 'num_images', minUnits: 1, roundUp: false },
    },
    isActive: true,
  },

  'freepik/generate-image-mystic': {
    integrationName: 'freepik',
    endpoint: 'generate-image-mystic',
    billingModel: 'per_request',
    baseCostPerUnit: 0.069,
    currency: 'USD',
    costModifiers: {
      baseMultipliers: {
        resolution: { '1k': 1.0, '2k': 1.72464, '4k': 5.50725 },
      },
    },
    isActive: true,
  },

  'freepik/generate-image-flux-dev': {
    integrationName: 'freepik',
    endpoint: 'generate-image-flux-dev',
    billingModel: 'per_request',
    baseCostPerUnit: 0.012,
    currency: 'USD',
    isActive: true,
  },

  // ---- Web Search (SerpAPI) ---- per-request billing
  'serpapi/search': {
    integrationName: 'serpapi',
    endpoint: 'search',
    billingModel: 'per_request',
    baseCostPerUnit: 0.01,
    currency: 'USD',
    isActive: true,
  },
}

export function getIntegrationConfig(
  integrationName: string,
  endpoint: string,
): IntegrationConfig | undefined {
  return INTEGRATION_CONFIGS[`${integrationName}/${endpoint}`]
}
