import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist/assets');
if (!fs.existsSync(dist)) {
  console.error('Bundle budget: dist/assets bulunamadı. Önce build çalıştırın.');
  process.exit(1);
}

const files = fs.readdirSync(dist)
  .filter((file) => file.endsWith('.js'))
  .map((file) => ({ file, bytes: fs.statSync(path.join(dist, file)).size }))
  .sort((a, b) => b.bytes - a.bytes);
const failures = files.filter(({ bytes }) => bytes > 600 * 1024);
if (failures.length) {
  console.error(`Bundle budget aşıldı (600 KB):\n${failures.map(({ file, bytes }) => `- ${file}: ${(bytes / 1024).toFixed(1)} KB`).join('\n')}`);
  process.exit(1);
}
console.log(`Bundle budget başarılı: en büyük chunk ${(files[0]?.bytes / 1024).toFixed(1)} KB.`);
