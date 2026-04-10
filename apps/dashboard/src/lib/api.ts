import { getAuthToken, parseSafeResponse } from 'deepspace'
import type { AppEntry, AppAnalytics, UserProfile, UsageSummary } from './types'

async function authedFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  })

  const { data, ok, status } = await parseSafeResponse<Record<string, unknown>>(res)

  if (!ok) {
    throw new Error((data.error as string) ?? `Request failed (${status})`)
  }

  return data as T
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

// ============================================================================
// Stripe
// ============================================================================

export interface StripeConfig {
  enabled: boolean
  publishableKey: string
  priceIds: {
    starter_monthly: string
    premium_monthly: string
    pay_per_credit: string
  }
  tierPriceCents: Record<string, number>
}

export interface SubscriptionStatus {
  currentTier: string
  hasActiveSubscription: boolean
  pendingTier: string | null
  pendingEffectiveDate: string | null
  currentPeriodEnd: string | null
}

export async function fetchStripeConfig(): Promise<StripeConfig> {
  const res = await fetch('/api/stripe/config')
  const { data, ok } = await parseSafeResponse<StripeConfig>(res)
  if (!ok) throw new Error('Failed to fetch Stripe config')
  return data
}

export async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  return authedFetch<SubscriptionStatus>('/api/stripe/subscription-status')
}

export async function createCheckoutSession(priceId: string): Promise<{ url: string; sessionId: string }> {
  return authedFetch<{ url: string; sessionId: string }>('/api/stripe/create-checkout-session', {
    method: 'POST',
    body: JSON.stringify({ priceId, returnUrl: window.location.origin + '/billing' }),
  })
}

export async function upgradeSubscription(targetPriceId: string): Promise<{
  success: boolean
  message: string
  previousTier: string
  newTier: string
  charged: number
  newCredits: number
}> {
  return authedFetch('/api/stripe/upgrade', {
    method: 'POST',
    body: JSON.stringify({ targetPriceId }),
  })
}

export async function createCreditCheckout(quantity?: number): Promise<{ url: string; sessionId: string }> {
  return authedFetch<{ url: string; sessionId: string }>('/api/stripe/create-credit-checkout', {
    method: 'POST',
    body: JSON.stringify({
      quantity: quantity ?? 1,
      returnUrl: window.location.origin + '/billing',
    }),
  })
}

export async function createPortalSession(): Promise<{ url: string }> {
  return authedFetch<{ url: string }>('/api/stripe/create-portal-session', {
    method: 'POST',
    body: JSON.stringify({ returnUrl: window.location.origin + '/billing' }),
  })
}
