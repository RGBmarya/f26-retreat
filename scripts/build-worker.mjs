import {readFile,readdir,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
async function collect(dir,base='') {
  const output={};
  for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
    const relative=path.posix.join(base,entry.name),full=path.join(dir,entry.name);
    if(entry.isDirectory())Object.assign(output,await collect(full,relative));
    else output['/'+relative]={type:types[path.extname(entry.name)]||'application/octet-stream',data:(await readFile(full)).toString('base64')};
  }
  return output;
}
const manifest=JSON.parse(await readFile('.openai/hosting.json','utf8'));
if(manifest.static)throw new Error('Password-protected deployment must not have a static directory');
const assets=await collect(path.join(root,'site'));
const source=(await readFile('worker/index.js','utf8')).replace('/* RETREAT_ASSETS */ {}',JSON.stringify(assets));
await rm('dist',{recursive:true,force:true});
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await writeFile('dist/server/index.js',source);
await copyFile('.openai/hosting.json','dist/.openai/hosting.json');
console.log('Built password-protected Worker with '+Object.keys(assets).length+' embedded files.');
