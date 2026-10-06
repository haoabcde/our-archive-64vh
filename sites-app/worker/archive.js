import {loadArchiveSeed} from './seed-loader.js';
import { database,seedArchive } from './database.js';
const enc=new TextEncoder();
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow',...headers}});
const local=(request,env)=>env.IS_LOCAL_PREVIEW===true&&['terminal.local','localhost','127.0.0.1'].includes(new URL(request.url).hostname);
const hex=buf=>Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('');
async function hmac(value,secret){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,enc.encode(value)));}
const equal=(a,b)=>{if(typeof a!=='string'||typeof b!=='string'||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
async function session(request,env){

  if(!env.SESSION_SECRET)return false;
  const match=request.headers.get('cookie')?.match(/(?:^|;\s*)archive_session=([^;]+)/);if(!match)return false;
  const [expires,nonce,signature]=match[1].split('.');if(!signature||Number(expires)<Date.now())return false;
  return equal(signature,await hmac(expires+'.'+nonce,env.SESSION_SECRET));
}
async function passwordHash(password,salt){const k=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},k,256));}
function cookie(request,value,age){return `archive_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
function today(){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
function viewRecord(r){const sealed=!!r.open_on&&r.open_on>today();return {...r,body:sealed?'':r.body,sealed};}
function fields(data,allowed=['photo','memory','reply','future']){
  const str=(key,max,fallback='')=>{const v=String(data[key]??fallback).trim();if(v.length>max)throw new Error(key+' too long');return v;};
  const type=str('type',20,'memory');if(!allowed.includes(type))throw new Error('请选择正确的记录类型');
  const result={type,title:str('title',120,type==='reply'?'她的回信':'新的记忆'),body:str('body',20000),place:str('place',100),category:str('category',30,'snaps'),author:str('author',40),occurred_on:str('occurred_on',10),open_on:str('open_on',10)};
  for(const k of ['occurred_on','open_on'])if(result[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(result[k])||!Number.isFinite(Date.parse(result[k]+'T00:00:00Z'))||new Date(result[k]+'T00:00:00Z').toISOString().slice(0,10)!==result[k]))throw new Error('日期格式不正确');
  if(!result.body&&type!=='photo')throw new Error('写下一点内容再保存吧');return result;
}
export async function handleArchive(request,env){
 const url=new URL(request.url),path=url.pathname,db=()=>database(env);
 if(!path.startsWith('/api/')&&!path.startsWith('/media/'))return null;
 if(!['GET','HEAD','POST','PATCH','DELETE'].includes(request.method))return json({error:'不支持的请求'},405);
 if(!['GET','HEAD'].includes(request.method)){
  const origin=request.headers.get('origin');if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return json({error:'请从本站保存内容'},403);
  if(Number(request.headers.get('content-length')||0)>18*1024*1024)return json({error:'图片过大，请选用 15 MB 以内的图片'},413);
 }
 try{
  if(path==='/api/session'&&request.method==='GET')return json({authenticated:await session(request,env)});
  if(path==='/api/login'&&request.method==='POST'){
   if(!env.PASSWORD_SALT||!env.PASSWORD_DIGEST||!env.SESSION_SECRET)return json({error:'入口暂时不可用，请稍后再试'},503);
   const ip=request.headers.get('cf-connecting-ip')||'preview';const key=await hmac('ip:'+ip,env.SESSION_SECRET);const now=Date.now();
   const attempt=await db().prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first();
   if(attempt&&attempt.blocked_until>now)return json({error:'尝试次数有点多，请 15 分钟后再试'},429);
   const data=await request.json();const pass=typeof data.password==='string'?data.password:'';
   if(pass.length>200||!equal(await passwordHash(pass,env.PASSWORD_SALT),env.PASSWORD_DIGEST)){
    const failures=attempt&&now-attempt.window_start<900000?attempt.failures+1:1;
    await db().prepare('INSERT INTO login_attempts (key,failures,window_start,blocked_until) VALUES (?,?,?,?) ON CONFLICT(key) DO UPDATE SET failures=excluded.failures,window_start=excluded.window_start,blocked_until=excluded.blocked_until').bind(key,failures,attempt&&now-attempt.window_start<900000?attempt.window_start:now,failures>=8?now+900000:0).run();
    return json({error:'密码不对，再想想？'},401);
   }
   await db().prepare('DELETE FROM login_attempts WHERE key=?').bind(key).run();
   const age=data.remember?30*86400:86400;const payload=(now+age*1000)+'.'+crypto.randomUUID();
   return json({ok:true},200,{'Set-Cookie':cookie(request,payload+'.'+await hmac(payload,env.SESSION_SECRET),age)});
  }
  if(path==='/api/logout'&&request.method==='POST')return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
  if(!await session(request,env))return json({error:'先解锁档案，再继续吧'},401);
  const {initialRecords,originalImages}=await loadArchiveSeed(env);
  await seedArchive(env,initialRecords);
  if(path==='/api/archive'&&request.method==='GET'){
   const records=await db().prepare('SELECT * FROM records WHERE deleted_at IS NULL ORDER BY created_at ASC,id ASC').all();
   const pref=await db().prepare('SELECT key,value FROM preferences WHERE key != ?').bind('archive-seeded-v1').all();
   return json({records:records.results.map(viewRecord),preferences:Object.fromEntries(pref.results.map(r=>[r.key,JSON.parse(r.value)]))});
  }
  if(path.startsWith('/media/')&&request.method==='GET'){
   const key=decodeURIComponent(path.slice(7));if(!/^((original|uploads)\/[a-zA-Z0-9_.-]+)$/.test(key))return json({error:'图片不存在'},404);
   if(!env.BUCKET)throw new Error('Photo storage unavailable');let obj=await env.BUCKET.get(key);
   if(!obj&&originalImages[key]){const bytes=Uint8Array.from(atob(originalImages[key]),c=>c.charCodeAt(0));await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:'image/webp'}});obj=await env.BUCKET.get(key);}
   if(!obj)return json({error:'图片不存在'},404);
   return new Response(obj.body,{headers:{'Content-Type':obj.httpMetadata?.contentType||'image/webp','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
  }
  if(path==='/api/records'&&request.method==='POST'){
   const multi=request.headers.get('content-type')?.includes('multipart/form-data');let data,file;
   if(multi){const form=await request.formData();data=Object.fromEntries(form.entries());file=form.get('file');}else data=await request.json();
   const f=fields(data);const id=typeof data.id==='string'&&/^USR-[a-f0-9-]{36}$/.test(data.id)?data.id:'USR-'+crypto.randomUUID();const now=new Date().toISOString();
   const existing=await db().prepare('SELECT id FROM records WHERE id=?').bind(id).first();if(existing)return json({ok:true,id},200);
   let photoKey='';if(f.type==='photo'){
    if(!file||typeof file.arrayBuffer!=='function'||file.size===0)throw new Error('先选择一张照片');if(file.size>15*1024*1024)return json({error:'请选择 15 MB 以内的照片'},413);
    const bytes=new Uint8Array(await file.arrayBuffer());const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
    if(!jpg&&!png&&!webp)throw new Error('请选择 JPG、PNG 或 WebP 照片');if(!env.BUCKET)throw new Error('Photo storage unavailable');photoKey='uploads/'+id+'.'+(jpg?'jpg':png?'png':'webp');await env.BUCKET.put(photoKey,bytes,{httpMetadata:{contentType:jpg?'image/jpeg':png?'image/png':'image/webp'}});
   }
   try{await db().prepare('INSERT INTO records (id,type,title,body,place,category,photo_key,occurred_on,open_on,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,f.type,f.title,f.body,f.place,f.category,photoKey,f.occurred_on,f.open_on,f.author,now,now).run();}catch(e){if(photoKey)await env.BUCKET.delete(photoKey);throw e;}
   return json({ok:true,id},201);
  }
  if(path.startsWith('/api/records/')&&['PATCH','DELETE'].includes(request.method)){
   const id=decodeURIComponent(path.slice('/api/records/'.length));
   const record=await db().prepare('SELECT * FROM records WHERE id=? AND deleted_at IS NULL').bind(id).first();
   if(!record)return json({error:'这页记录已经不存在了，请刷新档案'},404);
   if(viewRecord(record).sealed)return json({error:'这页记录还没有到开启日期'},403);
   const now=new Date().toISOString();
   if(request.method==='DELETE'){
    if(!id.startsWith('USR-')&&!id.startsWith('IMPORTED-'))return json({error:'原有档案请编辑修改'},403);
    await db().prepare('UPDATE records SET deleted_at=?,updated_at=? WHERE id=?').bind(now,now,id).run();return json({ok:true});
   }
   const data=await request.json();if(data.updated_at&&data.updated_at!==record.updated_at)return json({error:'这页刚被另一台设备改过，请重新打开后再编辑'},409);
   const f=fields({...data,type:record.type},[record.type]);
   await db().prepare('UPDATE records SET title=?,body=?,place=?,category=?,occurred_on=?,open_on=?,author=?,updated_at=? WHERE id=?').bind(f.title,f.body,f.place,f.category,f.occurred_on,f.open_on,f.author,now,id).run();
   return json({ok:true,id});
  }
  if(path==='/api/preferences'&&request.method==='POST'){
   const data=await request.json();if(!['hearts','likes','vouchers','fingerprint','medal','progress'].includes(data.key))return json({error:'不能保存这一项'},400);
   const value=JSON.stringify(data.value);if(value.length>20000)return json({error:'内容过长'},400);
   await db().prepare('INSERT INTO preferences (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(data.key,value,new Date().toISOString()).run();return json({ok:true});
  }
  if(path==='/api/import'&&request.method==='POST'){
   const backup=await request.json();if(!Array.isArray(backup.futureRecords))throw new Error('这不是旧站的档案备份');if(backup.futureRecords.length>500||JSON.stringify(backup).length>1024*1024)throw new Error('备份过大');
   let count=0;const ud=backup.userData||backup.footprints||{};const replies=ud.herReplies||backup.herReplies||[];if(!Array.isArray(replies))throw new Error('回信格式不正确');
   for(const [type,items] of [['future',backup.futureRecords],['reply',replies]])for(const item of items){
    if(!item)continue;const body=Array.isArray(item.paragraphs)?item.paragraphs.filter(x=>typeof x==='string').join('\n\n'):(item.content||item.body);if(typeof body!=='string'||!body.trim())continue;
    const f=fields({type,title:item.title||(type==='reply'?'她的回信':'未完待续'),body,author:item.author||'',occurred_on:item.date||'',open_on:item.openDate||''});const signature=hex(await crypto.subtle.digest('SHA-256',enc.encode(type+':'+(item.id||f.body))));const now=new Date().toISOString();
    const out=await db().prepare('INSERT OR IGNORE INTO records (id,type,title,body,place,category,photo_key,occurred_on,open_on,author,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind('IMPORTED-'+signature,type,f.title,f.body,'','','',f.occurred_on,f.open_on,f.author,item.createdAt||now,now).run();count+=out.meta?.changes||0;
   }
   const writePref=async(key,value)=>{await db().prepare('INSERT INTO preferences (key,value,updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),new Date().toISOString()).run();};
   if(Array.isArray(ud.likedLittleThings)){const old=await db().prepare('SELECT value FROM preferences WHERE key=?').bind('hearts').first();await writePref('hearts',[...new Set([...(old?JSON.parse(old.value):[]),...ud.likedLittleThings.filter(x=>typeof x==='string')])]);}
   if(Array.isArray(ud.redeemedVouchers)){const old=await db().prepare('SELECT value FROM preferences WHERE key=?').bind('vouchers').first();const value=old?JSON.parse(old.value):{};for(const id of ud.redeemedVouchers)if(typeof id==='string')value[id]=Math.max(1,Number(value[id])||0);await writePref('vouchers',value);}
   if(Array.isArray(ud.medals))await writePref('medal',ud.medals);
   if(backup.progress&&typeof backup.progress==='object')await writePref('progress',backup.progress);
   if(typeof ud.pufferHearts==='number')await writePref('fingerprint',{hearts:Math.max(0,ud.pufferHearts)});
   return json({ok:true,count});
  }
  if(path==='/api/export'&&request.method==='GET'){
   const records=await db().prepare('SELECT * FROM records WHERE deleted_at IS NULL ORDER BY created_at,id').all();const prefs=await db().prepare('SELECT key,value FROM preferences WHERE key != ?').bind('archive-seeded-v1').all();return json({version:'3.0',exportedAt:new Date().toISOString(),records:records.results.map(viewRecord),preferences:Object.fromEntries(prefs.results.map(r=>[r.key,JSON.parse(r.value)]))},200,{'Content-Disposition':'attachment; filename="our-archive-backup.json"'});
  }
  return json({error:'找不到这一页'},404);
 }catch(e){console.error('Archive operation failed:',e.message);const expected=/请选择|先选择|写下一点|日期格式|too long|备份|回信格式/.test(e.message);return json({error:expected?e.message:'这次没有成功保存，请稍后重试；你的输入还在。'},expected?400:503);}
}
