// ============================================================================
// API response types for the dashboard
// ============================================================================

export interface AppEntry {
  appId: string
  ownerUserId: string
  deployedAt: string
  versionId?: string
  url: string
}

export interface AppAnalytics {
  totals: {
    requests: number
    errors: number
    subrequests: number
  }
  cpuTime: {
    p50: number
    p99: number
  }
  timeseries: Array<{
    datetime: string
    requests: number
    errors: number
  }>
  period: string
}

export interface UserProfile {
  id: string
  name: string | null
  email: string | null
  image: string | null
  subscriptionStatus: string
  subscriptionTier: string
  createdAt: string
}

export interface UserCredits {
  userId: string
  credits: number
  subscriptionCredits: number
  bonusCredits: number
  purchasedCredits: number
}

export interface UsageByIntegration {
  name: string
  totalCost: number
  count: number
}

export interface UsageEntry {
  id: string
  integrationName: string
  endpoint: string
  totalCost: string
  status: string
  createdAt: string
}

export interface UsageSummary {
  credits: UserCredits
  usageByIntegration: UsageByIntegration[]
  recentUsage: UsageEntry[]
}
