require('dotenv/config');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const backendSource = path.resolve(projectRoot, process.env.BACKEND_SOURCE_DIR || '../backend/src');
const routesDir = path.join(backendSource, 'routes');
const outputFile = path.join(projectRoot, 'route-catalog.json');
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

function routeDeclarations(source, file) {
  const operations = [];
  const seen = new Set();
  const add = (method, route, line) => {
    const key = `${method.toUpperCase()} ${route}`;
    if (!seen.has(key)) {
      seen.add(key);
      operations.push({ method: method.toUpperCase(), route, source: file, line });
    }
  };
  const lineAt = (offset) => source.slice(0, offset).split('\n').length;

  const direct = /router\.(get|post|put|patch|delete|head|options)\s*\(\s*['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(direct)) add(match[1], match[2], lineAt(match.index));

  // Covers router.route('/x').get(...).post(...) declarations.
  const chained = /router\.route\s*\(\s*['"]([^'"]+)['"]\s*\)([\s\S]*?)(?=\n\s*(?:router\.|export default))/g;
  for (const match of source.matchAll(chained)) {
    for (const method of match[2].matchAll(/\.(get|post|put|patch|delete|head|options)\s*\(/g)) {
      add(method[1], match[1], lineAt(match.index));
    }
  }
  return operations;
}

function joinRoutes(prefix, route) {
  const joined = `${prefix}/${route}`.replace(/\/+/g, '/');
  return joined === '/' ? '/' : joined.replace(/\/$/, '');
}

const sourceFiles = fs.readdirSync(routesDir).filter((file) => file.endsWith('.routes.ts')).sort();
const operationsByFile = new Map();
for (const file of sourceFiles) {
  const fullPath = path.join(routesDir, file);
  operationsByFile.set(file, routeDeclarations(fs.readFileSync(fullPath, 'utf8'), file));
}

const indexSource = fs.readFileSync(path.join(routesDir, 'index.ts'), 'utf8');
const variableToFile = new Map([...indexSource.matchAll(/import\s+(\w+)\s+from\s+['"]\.\/(.+?\.routes)['"]/g)]
  .map((match) => [match[1], `${match[2]}.ts`]));
const mounts = [];
for (const match of indexSource.matchAll(/router\.use\(\s*['"]([^'"]*)['"]\s*,\s*(\w+)\s*\)/g)) {
  const file = variableToFile.get(match[2]);
  if (file) mounts.push({ prefix: match[1], file });
}

const operations = [
  { method: 'GET', route: '/health/live', source: 'app.ts', line: 136, public: true },
  { method: 'GET', route: '/health', source: 'app.ts', line: 140, public: true },
  { method: 'GET', route: '/health/ready', source: 'app.ts', line: 140, public: true },
  { method: 'GET', route: '/test', source: 'app.ts', line: 77, public: true },
];

for (const mount of mounts) {
  for (const operation of operationsByFile.get(mount.file) || []) {
    operations.push({ ...operation, route: joinRoutes(mount.prefix, operation.route) });
  }
}

// business-request.routes is mounted a second time under a project, which is
// intentionally included because both public contracts are used by the UI.
for (const operation of operationsByFile.get('business-request.routes.ts') || []) {
  operations.push({ ...operation, route: joinRoutes('/projects/:projectId/business-requests', operation.route), mount: 'project-nested' });
}

// The root router has a few inline work-item aliases not represented by a file.
for (const operation of routeDeclarations(indexSource, 'index.ts')) {
  operations.push({ ...operation, route: joinRoutes('/api/v1', operation.route) });
}

const normalized = operations
  .map((operation) => ({ ...operation, route: operation.route.startsWith('/api/v1') ? operation.route : joinRoutes('/api/v1', operation.route) }))
  .filter((operation, index, list) => list.findIndex((item) => item.method === operation.method && item.route === operation.route) === index)
  .sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));

fs.writeFileSync(outputFile, `${JSON.stringify({ sourceRoot: path.relative(projectRoot, backendSource), count: normalized.length, operations: normalized }, null, 2)}\n`);
console.log(`Generated ${normalized.length} endpoint operations at ${path.relative(projectRoot, outputFile)}`);
