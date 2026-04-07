/**
 * Finance integrations — crypto, stocks, currencies, market symbols.
 * Ported from Miyagi3: CryptoPriceService, CryptoSearchService, StockPriceService,
 * CurrencySearchService, MarketSymbolSearchService.
 */

import { z } from 'zod'
import type { IntegrationHandler, EndpointDefinition } from '../_types'

const B = (cost: number) => ({ model: 'per_request' as const, baseCost: cost, currency: 'USD' })

// ── Crypto (Coinbase — no API key needed) ───────────────────────────────────

const cryptoPrice: IntegrationHandler = async (_env, body) => {
  const symbol = body.symbol || body.id
  if (!symbol) throw new Error('symbol is required (e.g. BTC, ETH)')
  const pair = `${String(symbol).toUpperCase()}-USD`

  const response = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`)
  if (!response.ok) throw new Error(`Coinbase API error ${response.status}: ${await response.text()}`)
  const data: any = await response.json()
  return data.data
}

const cryptoSearch: IntegrationHandler = async (_env, body) => {
  const query = String(body.query || body.q || '').toLowerCase()

  const response = await fetch('https://api.coinbase.com/v2/currencies/crypto')
  if (!response.ok) throw new Error(`Coinbase API error ${response.status}: ${await response.text()}`)
  const data: any = await response.json()

  if (!query) return data.data

  return (data.data || []).filter((c: any) =>
    c.code?.toLowerCase().includes(query) ||
    c.name?.toLowerCase().includes(query),
  )
}

const currencySearch: IntegrationHandler = async (_env, body) => {
  const query = String(body.query || body.q || '').toLowerCase()

  const response = await fetch('https://api.coinbase.com/v2/currencies')
  if (!response.ok) throw new Error(`Coinbase API error ${response.status}: ${await response.text()}`)
  const data: any = await response.json()

  if (!query) return data.data

  return (data.data || []).filter((c: any) =>
    c.id?.toLowerCase().includes(query) ||
    c.name?.toLowerCase().includes(query),
  )
}

// ── Stocks (Finnhub — no API key needed for basic quote) ────────────────────

const stockPrice: IntegrationHandler = async (env, body) => {
  const symbol = body.symbol
  if (!symbol) throw new Error('symbol is required (e.g. AAPL, MSFT)')

  const apiKey = env.FINNHUB_API_KEY || ''
  const params = new URLSearchParams({ symbol: String(symbol).toUpperCase(), token: apiKey })
  const response = await fetch(`https://finnhub.io/api/v1/quote?${params}`)
  if (!response.ok) throw new Error(`Finnhub API error ${response.status}: ${await response.text()}`)
  return response.json()
}

// ── Market symbols (Alpha Vantage) ──────────────────────────────────────────

const searchSymbols: IntegrationHandler = async (env, body) => {
  if (!env.ALPHA_VANTAGE_API_KEY) throw new Error('ALPHA_VANTAGE_API_KEY not configured')
  const keywords = body.keywords || body.q
  if (!keywords) throw new Error('keywords is required')

  const params = new URLSearchParams({
    function: 'SYMBOL_SEARCH',
    keywords: String(keywords),
    apikey: env.ALPHA_VANTAGE_API_KEY,
  })
  const response = await fetch(`https://www.alphavantage.co/query?${params}`)
  if (!response.ok) throw new Error(`Alpha Vantage API error ${response.status}: ${await response.text()}`)
  return response.json()
}

const cryptoPriceSchema = z.object({
  symbol: z.string().optional(),
  id: z.string().optional(),
})

const cryptoSearchSchema = z.object({
  query: z.string().optional(),
  q: z.string().optional(),
})

const currencySearchSchema = z.object({
  query: z.string().optional(),
  q: z.string().optional(),
})

const stockPriceSchema = z.object({
  symbol: z.string(),
})

const searchSymbolsSchema = z.object({
  keywords: z.string().optional(),
  q: z.string().optional(),
})

export const endpoints: Record<string, EndpointDefinition> = {
  'coinbase/crypto-price':      { handler: cryptoPrice,    billing: B(0.001), schema: cryptoPriceSchema },
  'coinbase/search-crypto':     { handler: cryptoSearch,   billing: B(0.001), schema: cryptoSearchSchema },
  'coinbase/search-currencies': { handler: currencySearch, billing: B(0.001), schema: currencySearchSchema },
  'finnhub/stock-price':        { handler: stockPrice,     billing: B(0.001), schema: stockPriceSchema },
  'alphavantage/search-symbols': { handler: searchSymbols, billing: B(0.001), schema: searchSymbolsSchema },
}
