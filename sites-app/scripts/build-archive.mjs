import {build} from 'esbuild';
import {mkdirSync,copyFileSync,cpSync,existsSync,writeFileSync} from 'node:fs';
await build({entryPoints:['worker/index.js'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true});
mkdirSync('dist/.openai',{recursive:true});copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
if(existsSync('drizzle'))cpSync('drizzle','dist/drizzle',{recursive:true});
writeFileSync('dist/server/wrangler.json',JSON.stringify({name:'our-archive',main:'index.js',compatibility_date:'2026-10-01',assets:{directory:'../client',binding:'ASSETS',run_worker_first:true},d1_databases:[{binding:'DB',database_name:'archive-db',database_id:'local-placeholder',migrations_dir:'../drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:'archive-photos'}]},null,2));
console.log('Bundled authenticated archive Worker and schema migrations.');
