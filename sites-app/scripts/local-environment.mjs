import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync,unlinkSync} from 'node:fs';
import path from 'node:path';
export function createLocalEnvironment(root){
 const directory=path.join(root,'.sites-runtime');mkdirSync(directory,{recursive:true});
 const sql=new DatabaseSync(path.join(directory,'archive.sqlite'));
 sql.exec('PRAGMA journal_mode=WAL');sql.exec('CREATE TABLE IF NOT EXISTS __local_migrations (name TEXT PRIMARY KEY)');
 const migrations=path.join(root,'drizzle');if(existsSync(migrations))for(const name of readdirSync(migrations).filter(x=>x.endsWith('.sql')).sort())if(!sql.prepare('SELECT name FROM __local_migrations WHERE name=?').get(name)){sql.exec(readFileSync(path.join(migrations,name),'utf8'));sql.prepare('INSERT INTO __local_migrations (name) VALUES (?)').run(name);}
 const prepared=(query,args=[])=>({bind(...values){return prepared(query,values)},async first(){return sql.prepare(query).get(...args)||null},async all(){return {results:sql.prepare(query).all(...args)}},async run(){const r=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}});
 const bucket=path.join(directory,'photos');mkdirSync(bucket,{recursive:true});
 const values=Object.fromEntries(readFileSync(path.join(root,'.dev.vars'),'utf8').split('\n').filter(Boolean).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)]}));
 return {...values,IS_LOCAL_PREVIEW:true,DB:{prepare:prepared,async batch(items){sql.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results}catch(e){sql.exec('ROLLBACK');throw e}}},BUCKET:{async get(key){const file=path.join(bucket,key);if(!existsSync(file))return null;return {body:readFileSync(file),httpMetadata:JSON.parse(readFileSync(file+'.json','utf8'))}},async put(key,value,options={}){const file=path.join(bucket,key);mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,new Uint8Array(value));writeFileSync(file+'.json',JSON.stringify(options.httpMetadata||{}))},async delete(key){const file=path.join(bucket,key);for(const f of [file,file+'.json'])if(existsSync(f))unlinkSync(f)}}};
}
