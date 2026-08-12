#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

async function listFeatureFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFeatureFiles(fullPath, baseDir));
    } else if (entry.isFile() && entry.name.endsWith('.feature')) {
      files.push(path.relative(baseDir, fullPath).replaceAll(path.sep, '/'));
    }
  }

  return files.sort((a, b) => a.localeCompare(b, 'tr'));
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const featuresDir = path.join(rootDir, 'features');
  const outputPath = path.join(rootDir, 'bdd-katalogu.md');

  const featureFiles = await listFeatureFiles(featuresDir);

  const sections = [];
  const summaryRows = [];
  let totalScenarioCount = 0;

  for (const fileName of featureFiles) {
    const filePath = path.join(featuresDir, fileName);
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    const featureLine = lines.find((line) => line.startsWith('Özellik:')) || '';
    const featureName = featureLine.replace(/^Özellik:\s*/, '').trim() || fileName;

    const tagLine = lines.find((line) => line.trim().startsWith('@')) || '';
    const tags = tagLine.trim().split(/\s+/).filter(Boolean);

    const scenarioCount = lines.filter((line) => /^  Senaryo(?: Taslağı)?:/.test(line)).length;
    totalScenarioCount += scenarioCount;

    summaryRows.push(`| ${featureName} | \`${fileName}\` | ${tags.join(' ')} | ${scenarioCount} |`);

    sections.push(`## ${featureName}

- Dosya: \`features/${fileName}\`
- Etiketler: ${tags.length > 0 ? tags.map((tag) => `\`${tag}\``).join(' ') : '-'}
- Senaryo sayısı: ${scenarioCount}

\`\`\`gherkin
${content}
\`\`\`
`);
  }

  const output = `# BDD Senaryo Kataloğu

Bu dosya \`features/*.feature\` içeriklerinden üretilir. Senaryo cümlelerini tek yerde okumak için kullanın.

Güncellemek için:

\`\`\`bash
npm --prefix ui-automation run bdd:catalog
\`\`\`

Toplam senaryo sayısı: **${totalScenarioCount}**

## Özet

| Özellik | Dosya | Etiketler | Senaryo Sayısı |
| --- | --- | --- | --- |
${summaryRows.join('\n')}

${sections.join('\n')}
`;

  await fs.writeFile(outputPath, output, 'utf8');
  process.stdout.write(`BDD katalogu yazıldı: ${path.relative(rootDir, outputPath)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
