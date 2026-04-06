#!/usr/bin/env node
/**
 * Feature Installation Script (CommonJS)
 *
 * Installs DeepSpace features into an app directory.
 *
 * Usage (from scaffolded app):
 *   node .deepspace/scripts/add-feature.cjs <id> .
 *   node .deepspace/scripts/add-feature.cjs --list
 *   node .deepspace/scripts/add-feature.cjs --info <id>
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Environment-aware features path resolution
// ---------------------------------------------------------------------------

function findFeaturesDir() {
  const candidate = path.resolve(__dirname, '..', 'features');
  if (fs.existsSync(candidate)) return candidate;
  console.error('Error: Could not find features directory at ' + candidate);
  process.exit(1);
}

const FEATURES_DIR = findFeaturesDir();

// ---------------------------------------------------------------------------
// Resolve target directory
// ---------------------------------------------------------------------------

function resolveTargetDir(raw) {
  if (!raw) return null;
  if (path.isAbsolute(raw)) return raw;
  return path.resolve(raw);
}

// ---------------------------------------------------------------------------
// Category labels & ordering
// ---------------------------------------------------------------------------

const CATEGORY_LABELS = {
  assistant: 'AI Features',
  data: 'Data Features',
  nav: 'Navigation',
  layout: 'Layouts',
  display: 'Display',
  landing: 'Landing Page Sections',
};

const CATEGORY_ORDER = ['assistant', 'data', 'nav', 'layout', 'display', 'landing'];

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

function loadFeatureConfig(featureId) {
  const configPath = path.join(FEATURES_DIR, featureId, 'feature.json');
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {
    console.error(`Error reading ${configPath}:`, e.message);
    return null;
  }
}

function listFeatures() {
  const entries = fs.readdirSync(FEATURES_DIR, { withFileTypes: true });
  const configs = [];
  for (const e of entries) {
    if (e.isDirectory() && e.name !== 'scripts') {
      const config = loadFeatureConfig(e.name);
      if (config) configs.push(config);
    }
  }
  return configs;
}

function groupByCategory(features) {
  const groups = new Map();
  for (const f of features) {
    const category = f.category || 'other';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(f);
  }
  return groups;
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
}

// ---------------------------------------------------------------------------
// Install files
// ---------------------------------------------------------------------------

function installFeature(config, targetDir) {
  let copied = 0;
  let skipped = 0;

  for (const file of config.files) {
    const srcPath = path.join(FEATURES_DIR, config.id, file.src);
    const destPath = path.join(targetDir, file.dest);

    if (!fs.existsSync(srcPath)) {
      console.error(`   Warning: source not found: ${file.src}`);
      continue;
    }

    if (fs.existsSync(destPath)) {
      console.log(`   Exists (skipped): ${file.dest}`);
      skipped++;
    } else {
      copyFile(srcPath, destPath);
      console.log(`   Copied: ${file.dest}`);
      copied++;
    }
  }

  return { copied, skipped };
}

// ---------------------------------------------------------------------------
// Schema auto-integration (structural parse — no comments needed)
// ---------------------------------------------------------------------------

function integrateSchema(config, targetDir) {
  if (!config.schema) return false;

  const schemasPath = path.join(targetDir, 'src', 'schemas.ts');
  if (!fs.existsSync(schemasPath)) {
    printSchemaInstructions(config.schema);
    return false;
  }

  let content = fs.readFileSync(schemasPath, 'utf-8');
  const { exportName, importPath, spreadOperator } = config.schema;

  // Already integrated?
  const importPattern = new RegExp(`^import\\s+\\{[^}]*\\b${exportName}\\b`, 'm');
  if (importPattern.test(content)) {
    console.log(`   Schema already present: ${exportName}`);
    return false;
  }

  // Strict checks: verify the file has the expected structure
  const hasExportConst = content.includes('export const schemas');
  const hasArrayOpening = /export const schemas:\s*CollectionSchema\[\]\s*=\s*\[/.test(content);

  if (!hasExportConst || !hasArrayOpening) {
    console.log('   Could not auto-integrate schema (schemas.ts has unexpected structure)');
    printSchemaInstructions(config.schema);
    return false;
  }

  // 1. Add import before "export const schemas"
  const importLine = `import { ${exportName} } from '${importPath}'`;
  const afterImport = content.replace(
    /export const schemas/,
    `${importLine}\n\nexport const schemas`
  );

  if (afterImport === content) {
    console.log('   Could not insert import line');
    printSchemaInstructions(config.schema);
    return false;
  }

  // 2. Insert entry into the schemas array
  const schemaEntry = spreadOperator ? `...${exportName}` : exportName;
  const afterEntry = afterImport.replace(
    /export const schemas:\s*CollectionSchema\[\]\s*=\s*\[/,
    `export const schemas: CollectionSchema[] = [\n  ${schemaEntry},`
  );

  if (afterEntry === afterImport) {
    console.log('   Could not insert schema entry');
    printSchemaInstructions(config.schema);
    return false;
  }

  fs.writeFileSync(schemasPath, afterEntry);
  console.log(`   Schema integrated: ${exportName} -> schemas.ts`);
  return true;
}

function printSchemaInstructions(schema) {
  const { exportName, importPath, spreadOperator } = schema;
  const entry = spreadOperator ? `...${exportName}` : exportName;
  console.log('');
  console.log('   Add manually to src/schemas.ts:');
  console.log(`     import { ${exportName} } from '${importPath}'`);
  console.log(`     // then add ${entry} to the schemas array`);
}

// ---------------------------------------------------------------------------
// CSS auto-integration (append feature CSS to styles.css)
// ---------------------------------------------------------------------------

function integrateCss(config, targetDir) {
  if (!config.css || config.css.length === 0) return false;

  const stylesPath = path.join(targetDir, 'src', 'styles.css');
  if (!fs.existsSync(stylesPath)) {
    console.log('   Warning: Cannot integrate CSS — src/styles.css not found');
    return false;
  }

  let stylesContent = fs.readFileSync(stylesPath, 'utf-8');
  let integrated = 0;

  for (const cssFile of config.css) {
    const srcPath = path.join(FEATURES_DIR, config.id, cssFile);
    if (!fs.existsSync(srcPath)) {
      console.error(`   Warning: CSS source not found: ${cssFile}`);
      continue;
    }

    const cssContent = fs.readFileSync(srcPath, 'utf-8');

    // Check if already integrated by looking for a unique class/keyframe from the CSS
    // Use the first non-comment, non-empty line with a class or keyframe as fingerprint
    const fingerprint = cssContent.match(/\.([\w-]+)\s*\{|@keyframes\s+([\w-]+)/);
    if (fingerprint) {
      const marker = fingerprint[1] || fingerprint[2];
      if (stylesContent.includes(marker)) {
        console.log(`   CSS already present: ${cssFile} (found .${marker})`);
        continue;
      }
    }

    stylesContent += '\n' + cssContent;
    integrated++;
    console.log(`   CSS integrated: ${cssFile} -> styles.css`);
  }

  if (integrated > 0) {
    fs.writeFileSync(stylesPath, stylesContent);
  }

  return integrated > 0;
}

// ---------------------------------------------------------------------------
// Nav auto-wiring into nav.ts
// ---------------------------------------------------------------------------

const NAV_MARKER = '// ── Features add nav items below this line ──';

function integrateRoute(config, targetDir) {
  if (!config.route) return false;

  const navPath = path.join(targetDir, 'src', 'nav.ts');
  if (!fs.existsSync(navPath)) {
    printRouteInstructions(config.route);
    return false;
  }

  let content = fs.readFileSync(navPath, 'utf-8');
  const { path: routePath, component } = config.route;
  const label = component.replace(/Page$/, '');

  // Already wired?
  if (content.includes(`'${routePath}'`)) {
    console.log(`   Nav already present: ${routePath}`);
    return false;
  }

  if (!content.includes(NAV_MARKER)) {
    console.log('   Could not auto-wire nav (marker not found in nav.ts)');
    printRouteInstructions(config.route);
    return false;
  }

  const rolesStr = config.route.protected === false ? '' : ", roles: ['member' as Role]";
  const entry = `  { path: '${routePath}', label: '${label}'${rolesStr} },`;

  content = content.replace(NAV_MARKER, `${NAV_MARKER}\n${entry}`);
  fs.writeFileSync(navPath, content);
  console.log(`   Nav wired: ${routePath} (${label})`);

  // Route is automatic via generouted — page file in src/pages/ is enough
  console.log(`   Route: automatic (file-based routing via src/pages/)`);
  return true;
}

function printRouteInstructions(route) {
  const { path: routePath, component } = route;
  const label = component.replace(/Page$/, '');
  console.log('');
  console.log('   Add manually to src/nav.ts:');
  console.log(`     { path: '${routePath}', label: '${label}' },`);
}

// ---------------------------------------------------------------------------
// Post-install instructions (for features that need manual wiring)
// ---------------------------------------------------------------------------

function printPostInstallInstructions(config) {
  const instructions = config.instructions || [];

  if (instructions.length > 0) {
    console.log('\n--- Manual wiring needed ---\n');
    instructions.forEach((inst, i) => {
      console.log(`${i + 1}. ${inst}\n`);
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  // --help
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log('\nFeature Installation Script\n');
    console.log('Usage: node add-feature.js <feature-id> <app-dir>\n');
    console.log('Commands:');
    console.log('  <feature-id> <dir>  Install a feature into app dir');
    console.log('  --list, -l          List all available features');
    console.log('  --info <id>         Show detailed info about a feature');
    console.log('  --help, -h          Show this help\n');

    const features = listFeatures();
    const groups = groupByCategory(features);

    for (const category of CATEGORY_ORDER) {
      const categoryFeatures = groups.get(category);
      if (categoryFeatures && categoryFeatures.length > 0) {
        console.log(`\n${CATEGORY_LABELS[category] || category}:`);
        for (const f of categoryFeatures) {
          console.log(`  ${f.id.padEnd(22)} ${f.name}`);
        }
      }
    }

    console.log('\nExamples:');
    console.log('  add feature items-crud .');
    console.log('  node add-feature.js items-crud ../my-app');
    process.exit(0);
  }

  // --list
  if (args[0] === '--list' || args[0] === '-l') {
    console.log('\nAvailable Features\n');

    const features = listFeatures();
    const groups = groupByCategory(features);

    for (const category of CATEGORY_ORDER) {
      const categoryFeatures = groups.get(category);
      if (categoryFeatures && categoryFeatures.length > 0) {
        console.log(`${CATEGORY_LABELS[category] || category}:`);
        for (const f of categoryFeatures) {
          console.log(`  ${f.id.padEnd(22)} ${f.name.padEnd(24)} ${f.description}`);
        }
        console.log('');
      }
    }

    console.log('Use: node add-feature.js --info <feature-id>');
    process.exit(0);
  }

  // --info
  if (args[0] === '--info' || args[0] === '-i') {
    const featureId = args[1];
    if (!featureId) {
      console.error('\nError: Please specify a feature ID');
      process.exit(1);
    }
    const config = loadFeatureConfig(featureId);
    if (!config) {
      console.error(`\nError: Unknown feature: ${featureId}`);
      console.error('Use --list to see available features');
      process.exit(1);
    }

    console.log(`\n${config.name} (${config.id})`);
    if (config.category) {
      console.log(`   Category: ${CATEGORY_LABELS[config.category] || config.category}`);
    }
    console.log(`   ${config.description}\n`);
    console.log(`   ${config.details}\n`);

    console.log('   Files:');
    config.files.forEach(f => console.log(`   - ${f.src} -> ${f.dest}`));

    console.log('\n   Integration steps:');
    config.instructions.forEach((inst, i) => console.log(`   ${i + 1}. ${inst}`));

    if (config.patterns && config.patterns.length > 0) {
      console.log('\n   Patterns:');
      config.patterns.forEach(p => console.log(`   - ${p}`));
    }

    if (config.example) {
      console.log('\n   Example:');
      config.example.split('\n').forEach(line => console.log(`   ${line}`));
    }
    console.log('');
    process.exit(0);
  }

  // Install feature
  const featureId = args[0];
  const rawDir = args[1];
  const targetDir = resolveTargetDir(rawDir);

  if (!targetDir) {
    console.error('\nError: Please specify an app directory');
    console.error('Usage: node add-feature.js <feature-id> <app-dir>');
    process.exit(1);
  }

  const config = loadFeatureConfig(featureId);
  if (!config) {
    console.error(`\nError: Unknown feature: ${featureId}`);
    console.error('Use --list to see available features');
    process.exit(1);
  }

  if (!fs.existsSync(targetDir)) {
    console.error(`\nError: Target directory not found: ${targetDir}`);
    process.exit(1);
  }

  console.log(`\nInstalling: ${config.name}`);
  console.log(`   ${config.description}`);
  console.log(`   Target: ${targetDir}`);

  const { copied, skipped } = installFeature(config, targetDir);

  console.log(`\nCopied ${copied} file(s)${skipped > 0 ? `, skipped ${skipped} existing` : ''}`);

  // Auto-integrate schema, CSS, and route
  integrateSchema(config, targetDir);
  integrateCss(config, targetDir);
  integrateRoute(config, targetDir);

  // Print any remaining manual wiring instructions
  printPostInstallInstructions(config);

  if (config.patterns && config.patterns.length > 0) {
    console.log('--- Key patterns ---\n');
    config.patterns.forEach(p => console.log(`- ${p}`));
    console.log('');
  }
}

main();
