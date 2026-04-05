import { getAuthToken } from 'deepspace'
import type { AppEntry, AppAnalytics, UserProfile, UsageSummary } from './types'

async function authedFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`)
  }

  return body as T
}

export async function fetchApps(): Promise<AppEntry[]> {
  const data = await authedFetch<{ apps: AppEntry[] }>('/api/apps')
  return data.apps
}

export async function fetchAppAnalytics(
  appName: string,
  period: string = '24h',
): Promise<AppAnalytics> {
  return authedFetch<AppAnalytics>(
    `/api/apps/${encodeURIComponent(appName)}/analytics?period=${period}`,
  )
}

export async function fetchUserProfile(): Promise<UserProfile> {
  return authedFetch<UserProfile>('/api/users/me')
}

export async function fetchUsageSummary(): Promise<UsageSummary> {
  return authedFetch<UsageSummary>('/api/usage/summary')
}

export async function undeployApp(appName: string): Promise<void> {
  await authedFetch(`/api/deploy/${encodeURIComponent(appName)}`, {
    method: 'DELETE',
  })
}

export async function createCheckoutSession(): Promise<{ url: string }> {
  return authedFetch<{ url: string }>('/api/stripe/create-checkout-session', {
    method: 'POST',
  })
}

export async function createPortalSession(): Promise<{ url: string }> {
  return authedFetch<{ url: string }>('/api/stripe/create-portal-session', {
    method: 'POST',
  })
}
