// Client helpers for Google Calendar via miyagiAPI

export async function ensureGoogleCalendarAuth() {
  const miyagiAPI = window.miyagiAPI
  try {
    const result = await miyagiAPI.get('/api/integrations/status')
    const status = result.data || result
    if (status?.google?.calendar) return { ok: true }

    const authResult = await miyagiAPI.get('/api/integrations/google-auth-url', { service: 'calendar' })
    const auth = authResult.data || authResult
    return { ok: false, requiresOAuth: true, authUrl: auth?.authUrl }
  } catch (e) {
    return { ok: false, error: e?.message || 'Failed to check Google status' }
  }
}

export async function listGoogleEvents(params) {
  const miyagiAPI = window.miyagiAPI
  const result = await miyagiAPI.get('google-calendar-events', params)
  const payload = result.data || result
  if (payload.requiresOAuth) return payload
  return { events: payload.events }
}

export async function createGoogleEvents(payload) {
  const miyagiAPI = window.miyagiAPI
  const result = await miyagiAPI.post('/api/integrations/google-calendar-create-events', payload)
  const data = result.data || result
  if (data.requiresOAuth) return data
  return { created: data.created }
}
