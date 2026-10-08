import {cpSync,mkdirSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
const extensions=['.ps1','.py','.cjs','.cts','.md','.json','.template'];
for(const folder of ['runtime','frontends']) {
 const visit=dir=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())visit(path);else if(extensions.some(e=>path.endsWith(e))||entry.name==='native-ui'){mkdirSync(join('dist',dir),{recursive:true});cpSync(path,join('dist',path));}}};visit(folder);
}
