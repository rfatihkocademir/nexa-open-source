#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

async function listFeatureFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFeatureFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.feature')) {
      files.push(fullPath);
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'tr'));
}

function readMinTarget(args) {
  const minIndex = args.indexOf('--min');
  if (minIndex === -1) return null;

  const value = Number(args[minIndex + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('--min degeri pozitif bir tam sayi olmali.');
  }

  return value;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const featuresDir = path.join(rootDir, 'features');
  const minTarget = readMinTarget(process.argv.slice(2));
  const files = await listFeatureFiles(featuresDir);
  const rows = [];
  let total = 0;

  for (const filePath of files) {
    const content = await fs.readFile(filePath, 'utf8');
    const scenarioCount = content
      .split(/\r?\n/)
      .filter((line) => /^  Senaryo(?: Taslağı)?:/.test(line))
      .length;

    total += scenarioCount;
    rows.push({
      file: path.relative(rootDir, filePath).replaceAll(path.sep, '/'),
      scenarioCount,
    });
  }

  for (const row of rows) {
    process.stdout.write(`${String(row.scenarioCount).padStart(4, ' ')}  ${row.file}\n`);
  }

  process.stdout.write(`\nToplam BDD senaryo sayisi: ${total}\n`);

  if (minTarget !== null && total < minTarget) {
    process.stderr.write(`Hedef karsilanmadi: ${total}/${minTarget}\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

