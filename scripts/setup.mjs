import { run, findPython, python, root, existsSync, path } from './common.mjs';
try {
  if (!existsSync(python)) {
    const [command, args] = findPython();
    console.log('\nCreating a private Python environment for Voweltrace…');
    run(command, [...args, '-m', 'venv', path.join(root, '.venv')]);
  }
  run(python, ['-c', 'import sys; assert sys.version_info >= (3,12), "Voweltrace requires Python 3.12+"']);
  console.log('\nInstalling FastAPI and document readers…');
  run(python, ['-m', 'pip', 'install', '-r', path.join(root, 'backend/requirements.txt')]);
  console.log('\nInstalling React and Vite…');
  if (!process.env.npm_execpath) throw new Error('Run this setup through npm install or npm run setup.');
  run(process.execPath, [process.env.npm_execpath, 'ci'], path.join(root, 'frontend'));
  console.log('\nVoweltrace is ready. Run npm run dev, then open http://localhost:5173\n');
} catch (error) { console.error(`\nSetup failed: ${error.message}`); process.exitCode = 1; }
