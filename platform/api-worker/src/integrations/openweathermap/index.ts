/**
 * OpenWeatherMap integration — geocoding, current weather, forecast.
 * Ported from Miyagi3 WeatherService.ts.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const BILLING = { model: 'per_request' as const, baseCost: 0.0015, currency: 'USD' }

const geocoding: IntegrationHandler = async (env, body) => {
  if (!env.OPENWEATHER_API_KEY) throw new Error('OPENWEATHER_API_KEY not configured')

  const query = body.query || body.q
  if (!query) throw new Error('query is required')

  const params = new URLSearchParams({
    q: String(query),
    limit: String(body.limit || 5),
    appid: env.OPENWEATHER_API_KEY,
  })

  const response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?${params}`, {
    headers: { 'User-Agent': 'DeepSpace-Weather/1.0' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorText}`)
  }

  const data: any = await response.json()
  if (data.cod && data.cod !== 200 && data.cod !== '200') {
    throw new Error(data.message || `OpenWeatherMap error: ${data.cod}`)
  }

  return data
}

const current: IntegrationHandler = async (env, body) => {
  if (!env.OPENWEATHER_API_KEY) throw new Error('OPENWEATHER_API_KEY not configured')

  const location = body.location || body.q
  if (!location) throw new Error('location is required')

  const params = new URLSearchParams({
    q: String(location),
    units: (body.units as string) || 'metric',
    appid: env.OPENWEATHER_API_KEY,
  })

  const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params}`, {
    headers: { 'User-Agent': 'DeepSpace-Weather/1.0' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorText}`)
  }

  const raw: any = await response.json()
  if (raw.cod && raw.cod !== 200 && raw.cod !== '200') {
    throw new Error(raw.message || `OpenWeatherMap error: ${raw.cod}`)
  }

  return {
    dt: raw.dt,
    temp: raw.main?.temp,
    feels_like: raw.main?.feels_like,
    humidity: raw.main?.humidity,
    pressure: raw.main?.pressure,
    visibility: raw.visibility,
    description: raw.weather?.[0]?.description,
    icon: raw.weather?.[0]?.icon,
    wind_speed: raw.wind?.speed,
    wind_deg: raw.wind?.deg,
    sunrise: raw.sys?.sunrise,
    sunset: raw.sys?.sunset,
  }
}

const forecast: IntegrationHandler = async (env, body) => {
  if (!env.OPENWEATHER_API_KEY) throw new Error('OPENWEATHER_API_KEY not configured')

  const location = body.location || body.q
  if (!location) throw new Error('location is required')

  const params = new URLSearchParams({
    q: String(location),
    units: (body.units as string) || 'metric',
    appid: env.OPENWEATHER_API_KEY,
  })

  const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?${params}`, {
    headers: { 'User-Agent': 'DeepSpace-Weather/1.0' },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorText}`)
  }

  const raw: any = await response.json()
  if (raw.cod && raw.cod !== 200 && raw.cod !== '200') {
    throw new Error(raw.message || `OpenWeatherMap error: ${raw.cod}`)
  }

  return (raw.list || []).map((item: any) => ({
    dt: item.dt,
    temp: item.main?.temp,
    feels_like: item.main?.feels_like,
    humidity: item.main?.humidity,
    description: item.weather?.[0]?.description,
    icon: item.weather?.[0]?.icon,
  }))
}

export const endpoints: Record<string, EndpointDefinition> = {
  'openweathermap/geocoding': { handler: geocoding, billing: BILLING },
  'openweathermap/current': { handler: current, billing: BILLING },
  'openweathermap/forecast': { handler: forecast, billing: BILLING },
}
