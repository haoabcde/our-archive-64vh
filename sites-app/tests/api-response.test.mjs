import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/api.mjs';

test('HTML preview pages and malformed JSON offer recovery instead of a parser exception',async()=>{
 for(const response of [
  new Response('<!DOCTYPE html><html>Preview</html>',{headers:{'Content-Type':'text/html'}}),
  new Response('<!DOCTYPE html><html>Protected</html>',{status:403,headers:{'Content-Type':'text/html'}}),
  new Response('<!DOCTYPE html>',{headers:{'Content-Type':'application/json'}}),
  new Response('null',{headers:{'Content-Type':'application/json'}})
 ])await assert.rejects(api('/api/login',{},async()=>response),error=>error.code==='unexpected_response'&&error.message.includes('在浏览器中打开')&&!error.message.includes('Unexpected token'));
});

test('valid authentication responses retain their meaning and request JSON without caching',async()=>{
 let requestOptions;
 const success=await api('/api/session',{},async(_path,options)=>{requestOptions=options;return Response.json({authenticated:false});});
 assert.equal(success.authenticated,false);assert.equal(requestOptions.headers.get('Accept'),'application/json');assert.equal(requestOptions.cache,'no-store');assert.equal(requestOptions.credentials,'same-origin');
 await assert.rejects(api('/api/login',{},async()=>Response.json({error:'密码不对，再想想？'},{status:401})),error=>error.status===401&&error.message==='密码不对，再想想？');
 await assert.rejects(api('/api/session',{},async()=>{throw new TypeError('Failed to fetch');}),error=>error.code==='network_error');
});
