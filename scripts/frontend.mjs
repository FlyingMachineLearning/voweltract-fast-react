import { run, requireSetup, frontendArgs, root, path } from './common.mjs';
try { requireSetup(); run(process.execPath, frontendArgs(process.argv[2] || 'build'), path.join(root,'frontend')); }
catch(error) { console.error(error.message); process.exitCode=1; }
