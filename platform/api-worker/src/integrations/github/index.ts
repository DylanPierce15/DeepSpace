/**
 * GitHub integration — repos, users, PRs, commits, search.
 * Ported from Miyagi3 GitHubRepositoryService, GitHubUserService, GitHubPullRequestService.
 */

import type { IntegrationHandler, EndpointDefinition } from '../_types'

const GITHUB_API = 'https://api.github.com'

function githubHeaders(token?: string) {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'DeepSpace-GitHub/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) h['Authorization'] = `Bearer ${token}`
  return h
}

async function githubGet(env: any, path: string, params?: URLSearchParams): Promise<any> {
  const url = params ? `${GITHUB_API}${path}?${params}` : `${GITHUB_API}${path}`
  const response = await fetch(url, { headers: githubHeaders(env.GITHUB_TOKEN) })
  if (!response.ok) throw new Error(`GitHub API error ${response.status}: ${await response.text()}`)
  return response.json()
}

// ── User endpoints ──────────────────────────────────────────────────────────

const getUser: IntegrationHandler = async (env) => githubGet(env, '/user')

const getUserRepos: IntegrationHandler = async (env, body) => {
  const params = new URLSearchParams()
  if (body.sort) params.append('sort', String(body.sort))
  if (body.per_page) params.append('per_page', String(body.per_page))
  if (body.page) params.append('page', String(body.page))
  return githubGet(env, '/user/repos', params)
}

const getPublicUser: IntegrationHandler = async (env, body) => {
  if (!body.username) throw new Error('username is required')
  return githubGet(env, `/users/${body.username}`)
}

const getUserPublicRepos: IntegrationHandler = async (env, body) => {
  if (!body.username) throw new Error('username is required')
  const params = new URLSearchParams()
  if (body.sort) params.append('sort', String(body.sort))
  if (body.per_page) params.append('per_page', String(body.per_page))
  return githubGet(env, `/users/${body.username}/repos`, params)
}

// ── Repository endpoints ────────────────────────────────────────────────────

const getRepository: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}`)
}

const getRepositoryCommits: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const params = new URLSearchParams()
  if (body.sha) params.append('sha', String(body.sha))
  if (body.per_page) params.append('per_page', String(body.per_page))
  if (body.page) params.append('page', String(body.page))
  return githubGet(env, `/repos/${body.owner}/${body.repo}/commits`, params)
}

const getRepositoryIssues: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const params = new URLSearchParams()
  if (body.state) params.append('state', String(body.state))
  if (body.per_page) params.append('per_page', String(body.per_page))
  if (body.page) params.append('page', String(body.page))
  return githubGet(env, `/repos/${body.owner}/${body.repo}/issues`, params)
}

const searchRepositories: IntegrationHandler = async (env, body) => {
  if (!body.q) throw new Error('Search query (q) is required')
  const params = new URLSearchParams({ q: String(body.q) })
  if (body.sort) params.append('sort', String(body.sort))
  if (body.order) params.append('order', String(body.order))
  if (body.per_page) params.append('per_page', String(body.per_page))
  return githubGet(env, '/search/repositories', params)
}

const getRepositoryTree: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const sha = body.sha || 'HEAD'
  const params = new URLSearchParams()
  if (body.recursive) params.append('recursive', '1')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/git/trees/${sha}`, params)
}

const getRepositoryContents: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const path = body.path || ''
  const params = new URLSearchParams()
  if (body.ref) params.append('ref', String(body.ref))
  return githubGet(env, `/repos/${body.owner}/${body.repo}/contents/${path}`, params)
}

const getRepositoryLanguages: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/languages`)
}

const getRepositoryReadme: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/readme`)
}

// ── Pull request endpoints ──────────────────────────────────────────────────

const getRepositoryPulls: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const params = new URLSearchParams()
  if (body.state) params.append('state', String(body.state))
  if (body.per_page) params.append('per_page', String(body.per_page))
  return githubGet(env, `/repos/${body.owner}/${body.repo}/pulls`, params)
}

const getPullRequest: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo || !body.pull_number) throw new Error('owner, repo, and pull_number are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/pulls/${body.pull_number}`)
}

const getPullRequestReviews: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo || !body.pull_number) throw new Error('owner, repo, and pull_number are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/pulls/${body.pull_number}/reviews`)
}

const getPullRequestFiles: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo || !body.pull_number) throw new Error('owner, repo, and pull_number are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/pulls/${body.pull_number}/files`)
}

const getRepositoryContributors: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo) throw new Error('owner and repo are required')
  const params = new URLSearchParams()
  if (body.per_page) params.append('per_page', String(body.per_page))
  return githubGet(env, `/repos/${body.owner}/${body.repo}/contributors`, params)
}

const getCommit: IntegrationHandler = async (env, body) => {
  if (!body.owner || !body.repo || !body.sha) throw new Error('owner, repo, and sha are required')
  return githubGet(env, `/repos/${body.owner}/${body.repo}/commits/${body.sha}`)
}

const B = (cost: number) => ({ model: 'per_request' as const, baseCost: cost, currency: 'USD' })

export const endpoints: Record<string, EndpointDefinition> = {
  'github/get-user':                  { handler: getUser,                  billing: B(0.001) },
  'github/get-user-repos':            { handler: getUserRepos,             billing: B(0.002) },
  'github/get-public-user':           { handler: getPublicUser,            billing: B(0.001) },
  'github/get-user-public-repos':     { handler: getUserPublicRepos,       billing: B(0.002) },
  'github/get-repository':            { handler: getRepository,            billing: B(0.001) },
  'github/get-repository-commits':    { handler: getRepositoryCommits,     billing: B(0.003) },
  'github/get-repository-issues':     { handler: getRepositoryIssues,      billing: B(0.003) },
  'github/search-repositories':       { handler: searchRepositories,       billing: B(0.005) },
  'github/get-repository-tree':       { handler: getRepositoryTree,        billing: B(0.003) },
  'github/get-repository-contents':   { handler: getRepositoryContents,    billing: B(0.002) },
  'github/get-repository-languages':  { handler: getRepositoryLanguages,   billing: B(0.001) },
  'github/get-repository-readme':     { handler: getRepositoryReadme,      billing: B(0.001) },
  'github/get-repository-pulls':      { handler: getRepositoryPulls,       billing: B(0.003) },
  'github/get-pull-request':          { handler: getPullRequest,           billing: B(0.002) },
  'github/get-pull-request-reviews':  { handler: getPullRequestReviews,    billing: B(0.002) },
  'github/get-pull-request-files':    { handler: getPullRequestFiles,      billing: B(0.002) },
  'github/get-repository-contributors': { handler: getRepositoryContributors, billing: B(0.003) },
  'github/get-commit':                { handler: getCommit,                billing: B(0.002) },
}
