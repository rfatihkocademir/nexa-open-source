#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const backendNodeModules = path.resolve(rootDir, '..', 'backend', 'node_modules');
const localCli = path.join(rootDir, 'node_modules', 'playwright', 'cli.js');
const backendCli = path.join(backendNodeModules, 'playwright', 'cli.js');

const cliPath = fs.existsSync(localCli) ? localCli : backendCli;

if (!fs.existsSync(cliPath)) {
  console.error('Playwright CLI bulunamadı.');
  console.error(`Aranan yollar: ${localCli} ve ${backendCli}`);
  process.exit(1);
}

const env = { ...process.env };

if (!fs.existsSync(localCli)) {
  const existingNodePath = env.NODE_PATH ? env.NODE_PATH.split(path.delimiter).filter(Boolean) : [];
  if (!existingNodePath.includes(backendNodeModules)) {
    existingNodePath.unshift(backendNodeModules);
  }
  env.NODE_PATH = existingNodePath.join(path.delimiter);
}

const args = process.argv.slice(2);
const result = spawnSync(process.execPath, [cliPath, ...args], {
  cwd: rootDir,
  env,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
