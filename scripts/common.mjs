import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const python = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} exited with code ${result.status}.`);
}
export function findPython() {
  const candidates = process.env.VOWELTRACE_PYTHON ? [[process.env.VOWELTRACE_PYTHON, []]] : (process.platform === 'win32' ? [['py', ['-3']], ['python', []], ['python3', []]] : [['python3', []], ['python', []]]);
  for (const [command, args] of candidates) {
    const result = spawnSync(command, [...args, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)'], { stdio: 'ignore' });
    if (!result.error && result.status === 0) return [command, args];
  }
  throw new Error('Python 3.12+ was not found. Install Python from python.org, reopen PowerShell, then run npm install again. You can set VOWELTRACE_PYTHON to your Python executable path.');
}
export function requireSetup() {
  if (!existsSync(python) || !existsSync(path.join(root, 'frontend/node_modules/vite/bin/vite.js'))) throw new Error('Setup is incomplete. Run npm install from the Voweltrace root folder first.');
}
export function frontendArgs(command, extra = []) {
  return [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), ...(command ? [command] : []), ...extra];
}
export { spawn, existsSync, path };
