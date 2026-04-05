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
  const candidates = [
    // .deepspace/scripts/add-feature.cjs → .deepspace/features/
    path.resolve(__dirname, '..', 'features'),
    // packages/create-deepspace/scripts/add-feature.cjs → ../features/
    path.resolve(__dirname, '..', 'features'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  console.error('Error: Could not find features directory. Searched:');
  candidates.forEach(c => console.error('  ' + c));
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
    console.log('   Warning: Cannot integrate schema — src/schemas.ts not found');
    return false;
  }

  let content = fs.readFileSync(schemasPath, 'utf-8');
  const { exportName, importPath, spreadOperator } = config.schema;

  // Already integrated? Check for actual import statement (not comments)
  const importPattern = new RegExp(`^import\\s+\\{[^}]*\\b${exportName}\\b`, 'm');
  if (importPattern.test(content)) {
    console.log(`   Schema already present: ${exportName}`);
    return false;
  }

  // 1. Add import before "export const schemas"
  const importLine = `import { ${exportName} } from '${importPath}'`;
  content = content.replace(
    /export const schemas/,
    `${importLine}\n\nexport const schemas`
  );

  // 2. Find the schemas array opening and insert entry after it
  const schemaEntry = spreadOperator ? `...${exportName}` : exportName;
  content = content.replace(
    /export const schemas:\s*CollectionSchema\[\]\s*=\s*\[/,
    `export const schemas: CollectionSchema[] = [\n  ${schemaEntry},`
  );

  fs.writeFileSync(schemasPath, content);
  console.log(`   Schema integrated: ${exportName} -> schemas.ts`);
  return true;
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
// Post-install instructions (route & nav — agent wires manually)
// ---------------------------------------------------------------------------

function printPostInstallInstructions(config) {
  const instructions = [];

  if (config.route) {
    const { path: routePath, component, importPath } = config.route;
    instructions.push(
      `Add route to App.tsx:\n` +
      `     import ${component} from '${importPath}'\n` +
      `     <Route path="${routePath}" element={<${component} />} />`
    );

    const label = component.replace(/Page$/, '');
    instructions.push(
      `Add nav item for '${routePath}' with label '${label}'`
    );
  }

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
    console.error('\nError: Please specify a app directory');
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

  // Auto-integrate schema and CSS
  integrateSchema(config, targetDir);
  integrateCss(config, targetDir);

  // Print manual wiring instructions
  printPostInstallInstructions(config);

  if (config.patterns && config.patterns.length > 0) {
    console.log('--- Key patterns ---\n');
    config.patterns.forEach(p => console.log(`- ${p}`));
    console.log('');
  }
}

main();
