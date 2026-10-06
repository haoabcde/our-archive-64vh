import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {randomBytes,pbkdf2Sync} from 'node:crypto';
import {handleArchive} from '../worker/archive.js';
import {createLocalEnvironment} from '../scripts/local-environment.mjs';
import {loadArchiveSeed} from '../worker/seed-loader.js';
import {readFileSync} from 'node:fs';

test('password protection, durable records, private photos, capsules and old-backup import',async()=>{
 const root=mkdtempSync(path.join(tmpdir(),'archive-test-'));cpSync(new URL('../drizzle',import.meta.url),path.join(root,'drizzle'),{recursive:true});
 const password=randomBytes(16).toString('hex'),salt=randomBytes(16).toString('hex'),secret=randomBytes(32).toString('hex');
 writeFileSync(path.join(root,'.dev.vars'),`PASSWORD_SALT=${salt}\nPASSWORD_DIGEST=${pbkdf2Sync(password,salt,100000,32,'sha256').toString('hex')}\nSESSION_SECRET=${secret}\n`);
 const env=createLocalEnvironment(root);env.ARCHIVE_SEED_KEY=readFileSync(new URL('../.dev.vars',import.meta.url),'utf8').split('\n').find(l=>l.startsWith('ARCHIVE_SEED_KEY=')).slice('ARCHIVE_SEED_KEY='.length);const {originalImages}=await loadArchiveSeed(env);let sessionCookie='';
 const request=(route,{method='GET',data,cookie=sessionCookie,origin,body,ip='client-one'}={})=>new Request('https://archive.test'+route,{method,headers:{...(cookie?{cookie}:{}),'cf-connecting-ip':ip,...(data?{'Content-Type':'application/json'}:{}),...(origin?{origin}:{})},...(method==='GET'?{}:{body:body||JSON.stringify(data||{})})});
 const call=(route,options)=>handleArchive(request(route,options),env);
 try{
  assert.equal((await call('/api/archive',{cookie:''})).status,401);
  assert.equal((await call('/media/original/PH-002.webp',{cookie:''})).status,401);
  assert.equal((await call('/api/records',{method:'POST',data:{body:'test'},origin:'https://evil.test'})).status,403);
  assert.equal((await call('/api/login',{method:'POST',data:{password:'incorrect'},cookie:''})).status,401);
  const login=await call('/api/login',{method:'POST',data:{password},cookie:''});assert.equal(login.status,200);sessionCookie=login.headers.get('set-cookie').split(';')[0];assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/Secure/);
  const seed=await (await call('/api/archive')).json();assert.equal(seed.records.filter(r=>r.type==='photo').length,15);assert.equal(seed.records.filter(r=>r.type==='letter').length,1);
  const firstPhoto=await call('/media/original/PH-002.webp');assert.equal(firstPhoto.status,200);assert.equal(firstPhoto.headers.get('cache-control'),'no-store');assert.ok((await firstPhoto.arrayBuffer()).byteLength>1000);
  const create=await call('/api/records',{method:'POST',data:{type:'reply',title:'测试回信',body:'这是独立客户端的测试回信',author:'QA'}});assert.equal(create.status,201);const id=(await create.json()).id;
  const secondLogin=await call('/api/login',{method:'POST',data:{password},cookie:'',ip:'client-two'});const secondCookie=secondLogin.headers.get('set-cookie').split(';')[0];const secondRead=await (await call('/api/archive',{cookie:secondCookie})).json();assert.ok(secondRead.records.some(r=>r.id===id&&r.body.includes('独立客户端')));
  const saved=secondRead.records.find(r=>r.id===id);assert.equal((await call('/api/records/'+id,{method:'PATCH',data:{...saved,body:'修改后'}})).status,200);assert.equal((await call('/api/records/'+id,{method:'PATCH',data:{...saved,body:'过时修改'}})).status,409);
  assert.equal((await call('/api/records',{method:'POST',data:{type:'future',title:'封缄',body:'尚未开启的内容',open_on:'2099-12-31'}})).status,201);const capsule=(await (await call('/api/archive')).json()).records.find(r=>r.title==='封缄');assert.equal(capsule.body,'');assert.equal(capsule.sealed,true);assert.equal((await call('/api/records/'+capsule.id,{method:'PATCH',data:{...capsule,body:'企图提前编辑'}})).status,403);
  assert.equal((await call('/api/records',{method:'POST',data:{type:'memory',title:'错误日期',body:'test',occurred_on:'2026-02-31'}})).status,400);
  const upload=new FormData();upload.set('type','photo');upload.set('title','上传测试');upload.set('file',new File([Buffer.from(originalImages['original/PH-002.webp'],'base64')],'test.webp',{type:'image/webp'}));const uploaded=await call('/api/records',{method:'POST',body:upload});assert.equal(uploaded.status,201);const photoId=(await uploaded.json()).id;const photo=(await (await call('/api/archive')).json()).records.find(r=>r.id===photoId);assert.equal((await call('/media/'+photo.photo_key,{cookie:secondCookie})).status,200);
  const invalid=new FormData();invalid.set('type','photo');invalid.set('file',new File(['not an image'],'fake.jpg',{type:'image/jpeg'}));assert.equal((await call('/api/records',{method:'POST',body:invalid})).status,400);
  const backup={futureRecords:[{id:'old-future',content:'旧站的未来记录',createdAt:'2025-01-01T00:00:00Z'}],userData:{herReplies:[{id:'old-reply',title:'原站回信标题',date:'2025-05-20',paragraphs:['第一段','第二段']}],likedLittleThings:['LT-001'],redeemedVouchers:['vc-hug']}};
  const imported=await call('/api/import',{method:'POST',data:backup});assert.equal(imported.status,200);assert.equal((await imported.json()).count,2);assert.equal((await (await call('/api/import',{method:'POST',data:backup})).json()).count,0);
  const after=(await (await call('/api/archive')).json());assert.ok(after.records.some(r=>r.title==='原站回信标题'&&r.body==='第一段\n\n第二段'));assert.deepEqual(after.preferences.hearts,['LT-001']);assert.equal(after.preferences.vouchers['vc-hug'],1);
  assert.equal((await call('/api/preferences',{method:'POST',data:{key:'likes',value:['PH-002']}})).status,200);assert.deepEqual((await (await call('/api/archive',{cookie:secondCookie})).json()).preferences.likes,['PH-002']);
  assert.equal((await call('/api/records/'+id,{method:'DELETE'})).status,200);assert.ok(!(await (await call('/api/archive')).json()).records.some(r=>r.id===id));assert.equal((await call('/api/records/PH-002',{method:'DELETE'})).status,403);
  const exported=await (await call('/api/export')).json();assert.ok(exported.records);assert.deepEqual(exported.preferences.likes,['PH-002']);assert.equal(exported.records.find(r=>r.title==='封缄').body,'');
  for(let i=0;i<8;i++)await call('/api/login',{method:'POST',data:{password:'wrong'},cookie:'',ip:'blocked-client'});assert.equal((await call('/api/login',{method:'POST',data:{password},cookie:'',ip:'blocked-client'})).status,429);
  assert.equal((await call('/api/archive',{cookie:'archive_session=0.fake.signature'})).status,401);
  assert.equal((await call('/api/logout',{method:'POST'})).headers.get('set-cookie').includes('Max-Age=0'),true);
 }finally{rmSync(root,{recursive:true,force:true});}
});
