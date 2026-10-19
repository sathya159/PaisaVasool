import {spawn} from 'node:child_process';
import {createConnection} from 'node:net';
const listening=port=>new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port});socket.once('connect',()=>{socket.destroy();resolve(true);});socket.once('error',()=>resolve(false));});
const children=[];
const run=args=>{const child=spawn(process.execPath,args,{stdio:'inherit',env:{...process.env,EXPO_NO_TELEMETRY:'1'}});children.push(child);return child;};
let stopping=false;
function stop(){stopping=true;for(const child of children)child.kill();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
function ai(){const child=run(['server/local-ai.mjs']);child.on('exit',()=>{if(!stopping){console.log('Restarting local AI in 3 seconds…');setTimeout(ai,3000);}});}
if(!await listening(8787))ai();else console.log('Using existing AI backend on 8787.');
if(!await listening(8081)){const web=run(['node_modules/expo/bin/cli','start','--web','--localhost','--port','8081']);web.on('exit',stop);}else console.log('Preview already available at http://localhost:8081');

