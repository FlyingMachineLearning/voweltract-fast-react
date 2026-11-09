import net from 'node:net';
import { spawn, requireSetup, python, root, path, frontendArgs } from './common.mjs';
const children=[];
let stopping=false;
function stop(code=0) {
  if(stopping) return;
  stopping=true;
  process.exitCode=code;
  for(const child of children) { if(child.exitCode===null) child.kill('SIGTERM'); }
}
function start(command,args,cwd) {
  const child=spawn(command,args,{cwd,stdio:'inherit',env:process.env});children.push(child);
  child.on('error',error=>{console.error(error.message);stop(1)});
  child.on('exit',code=>{if(!stopping)stop(code||0)});
  return child;
}
function checkPort(port) {
  return new Promise((resolve,reject)=>{
    const server=net.createServer();
    server.once('error',()=>reject(new Error(`Port ${port} is already in use. Stop the app using it, then retry npm run dev.`)));
    server.listen(port,'127.0.0.1',()=>server.close(resolve));
  });
}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
try {
  requireSetup();
  await checkPort(8000);await checkPort(5173);
  start(python,['-m','uvicorn','main:app','--host','127.0.0.1','--port','8000'],path.join(root,'backend'));
  let ready=false;
  for(let i=0;i<100&&!stopping;i++) {
    try {const response=await fetch('http://127.0.0.1:8000/api/health',{signal:AbortSignal.timeout(500)});if(response.ok){ready=true;break}} catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!ready) throw new Error('FastAPI did not start. Review the Python error above.');
  start(process.execPath,frontendArgs('', ['--host','127.0.0.1','--port','5173','--strictPort']),path.join(root,'frontend'));
  console.log('\nVoweltrace → http://localhost:5173\nKeep this terminal open. Press Ctrl+C to stop both servers.\n');
} catch(error) {console.error(error.message);stop(1)}
