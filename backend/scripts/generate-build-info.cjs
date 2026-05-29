#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const outFile = path.resolve(__dirname, '..', 'src', 'build-info.generated.ts');

const getGitHash = () => {
  const envHash = (process.env.BACKEND_BUILD_HASH || process.env.GITHUB_SHA || process.env.CF_PAGES_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '').trim();
  if (envHash) return envHash.slice(0, 12);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'unknown';
  } catch {
    return 'unknown';
  }
};

const hash = getGitHash();
const time = (process.env.BACKEND_BUILD_TIME || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')).trim();

const content = `export const GENERATED_BACKEND_BUILD_HASH = ${JSON.stringify(hash)};\nexport const GENERATED_BACKEND_BUILD_TIME = ${JSON.stringify(time)};\n`;
fs.writeFileSync(outFile, content, 'utf8');
console.log(`Generated ${path.relative(repoRoot, outFile)} hash=${hash} time=${time}`);
