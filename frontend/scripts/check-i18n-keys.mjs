import fs from 'node:fs';
import path from 'node:path';

const sourceRoot = path.resolve('src');
const flatten = (value, prefix = '') => Object.entries(value).flatMap(([key, item]) => {
  const full = prefix ? `${prefix}.${key}` : key;
  return item && typeof item === 'object' && !Array.isArray(item) ? flatten(item, full) : [full];
});
const keys = new Set();
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
  const file = path.join(directory, entry.name);
  if (entry.isDirectory()) walk(file);
  else if (/\.(ts|tsx)$/.test(entry.name)) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/\bt\(\s*['\"]([^'\"]+)['\"]/g)) keys.add(match[1]);
  }
});
walk(sourceRoot);

const locales = ['en', 'tr'].map((language) => ({
  language,
  keys: new Set(flatten(JSON.parse(fs.readFileSync(path.resolve(`src/locales/${language}.json`), 'utf8')))),
}));
const failures = locales.flatMap(({ language, keys: localeKeys }) => [...keys].filter((key) => !localeKeys.has(key)).map((key) => `${language}: ${key}`));
if (failures.length) {
  console.error(`Eksik çeviri anahtarı bulundu:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`i18n key denetimi başarılı: ${keys.size} statik anahtar iki locale'de de mevcut.`);
