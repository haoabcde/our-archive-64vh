export const archiveUrl='https://our-archive-letter.haoabcde.chatgpt.site';

function unexpectedResponse(response){
 const error=new Error('当前预览没有收到网站数据，请在浏览器中打开本站后重试。');
 error.code='unexpected_response';error.httpStatus=response.status;
 return error;
}

export async function api(path,options={},fetcher=fetch){
 const headers=new Headers(options.headers);
 if(!headers.has('Accept'))headers.set('Accept','application/json');
 let response;
 try{response=await fetcher(path,{credentials:'same-origin',...options,cache:'no-store',headers});}
 catch(cause){const error=new Error('网络连接中断，请稍后再试。');error.code='network_error';error.cause=cause;throw error;}
 // A preview gateway or protection page can return HTML, even with status 200.
 // Do not expose a JSON parser exception or mistake that page for app data.
 const type=response.headers.get('Content-Type')||'';
 if(!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(type))throw unexpectedResponse(response);
 let data;
 try{data=await response.json();}catch{throw unexpectedResponse(response);}
 if(!data||typeof data!=='object'||Array.isArray(data))throw unexpectedResponse(response);
 if(!response.ok){const error=new Error(typeof data.error==='string'?data.error:'这次没能成功，请稍后再试。');error.status=response.status;throw error;}
 return data;
}
