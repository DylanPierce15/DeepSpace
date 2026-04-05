#!/usr/bin/env node
/**
 * Wire a feature's page into pages.ts.
 * Inserts one lazy-loaded entry after the marker comment.
 * Usage: node wire-page.cjs <app-dir> <feature.json-path>
 */

const fs = require('fs')
const path = require('path')

const appDir = process.argv[2]
const featureJsonPath = process.argv[3]

if (!appDir || !featureJsonPath) {
  console.error('Usage: node wire-page.cjs <app-dir> <feature.json>')
  process.exit(1)
}

const feature = JSON.parse(fs.readFileSync(featureJsonPath, 'utf-8'))

if (!feature.route) {
  console.log('  No route to wire for ' + feature.id)
  process.exit(0)
}

const pagesPath = path.join(appDir, 'src', 'pages.ts')
if (!fs.existsSync(pagesPath)) {
  console.log('  Warning: src/pages.ts not found')
  process.exit(0)
}

let content = fs.readFileSync(pagesPath, 'utf-8')

const { path: routePath, component, importPath } = feature.route

// Check if already added
if (content.includes("path: '" + routePath + "'")) {
  console.log('  Page already registered: ' + routePath)
  process.exit(0)
}

// Build roles suffix
let rolesSuffix = ''
if (feature.route.protected && feature.route.allowedRoles) {
  const roles = feature.route.allowedRoles.map(r => "'" + r + "'").join(', ')
  rolesSuffix = ', roles: [' + roles + ']'
}

// Build the page entry — lazy with .then() wrapper for named exports
const label = component.replace(/Page$/, '')
const line = "  { path: '" + routePath + "', label: '" + label + "', component: lazy(() => import('" + importPath + "').then(m => ({ default: m." + component + " })))" + rolesSuffix + ' },'

// Insert after the marker comment — single insertion point
const marker = '// ── Features add pages below this line ──'
if (content.includes(marker)) {
  content = content.replace(marker, marker + '\n' + line)
} else {
  // Fallback: insert before closing bracket
  content = content.replace(/^(\])/m, line + '\n$1')
}

fs.writeFileSync(pagesPath, content)
console.log('  Added page: ' + routePath + ' -> ' + component)
