import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

const root = path.resolve(import.meta.dirname, '..', '..');

test('app image uses a static nginx config instead of proxying to itself', async () => {
  const dockerfile = await readFile(path.join(root, 'Dockerfile'), 'utf8');
  const appNginx = await readFile(path.join(root, 'app.nginx.conf'), 'utf8');

  assert.match(dockerfile, /COPY\s+app\.nginx\.conf\s+\/etc\/nginx\/conf\.d\/default\.conf/);
  assert.match(appNginx, /root\s+\/usr\/share\/nginx\/html;/);
  assert.match(appNginx, /try_files\s+\$uri\s+\$uri\/\s+\/index\.html;/);
  assert.doesNotMatch(appNginx, /proxy_pass\s+http:\/\/app:80/);
});

test('docker and auth config do not ship production with default secrets', async () => {
  const compose = await readFile(path.join(root, 'docker-compose.yml'), 'utf8');
  const prodCompose = await readFile(path.join(root, 'docker-compose.prod.yml'), 'utf8');
  const auth = await readFile(path.join(root, 'backend', 'src', 'auth.js'), 'utf8');
  const backendDockerfile = await readFile(path.join(root, 'backend', 'Dockerfile'), 'utf8');
  const backendEnvExample = await readFile(path.join(root, 'backend', '.env.example'), 'utf8');
  const dockerignore = await readFile(path.join(root, '.dockerignore'), 'utf8');

  assert.doesNotMatch(compose, /change-me-in-production/);
  assert.doesNotMatch(auth, /change-me-in-production/);
  assert.doesNotMatch(backendEnvExample, /change-me-in-production/);
  assert.match(dockerignore, /^\.env$/m);
  assert.match(dockerignore, /^\.env\.\*$/m);
  assert.match(dockerignore, /^!\.env\*\.example$/m);
  assert.match(prodCompose, /\$\{JWT_SECRET:\?JWT_SECRET is required/);
  assert.match(prodCompose, /\$\{POSTGRES_PASSWORD:\?POSTGRES_PASSWORD is required/);
  assert.match(auth, /NODE_ENV\s*===\s*'production'/);
  assert.match(backendDockerfile, /ENV\s+NODE_ENV=production/);
  assert.match(backendDockerfile, /npm\s+ci\s+--omit=dev/);
});

test('production compose does not publish internal service ports directly', async () => {
  const prodCompose = await readFile(path.join(root, 'docker-compose.prod.yml'), 'utf8');

  assert.match(prodCompose, /api:[\s\S]*ports:\s+!reset\s+\[\]/);
  assert.match(prodCompose, /postgres:[\s\S]*ports:\s+!reset\s+\[\]/);
  assert.match(prodCompose, /redis:[\s\S]*ports:\s+!reset\s+\[\]/);
});
