import { run, requireSetup, python, root, path } from './common.mjs';
try { requireSetup(); run(python, ['-m','pytest','tests','-q'], path.join(root,'backend')); }
catch(error) { console.error(error.message); process.exitCode=1; }
