import {encryptedArchive,archiveIv} from './seed.js';
let cached;
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
export async function loadArchiveSeed(env){
 if(cached)return cached;
 if(!env.ARCHIVE_SEED_KEY)throw new Error('Archive seed key unavailable');
 const key=await crypto.subtle.importKey('raw',bytes(env.ARCHIVE_SEED_KEY),'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(archiveIv)},key,bytes(encryptedArchive));
 cached=JSON.parse(new TextDecoder().decode(plain));return cached;
}
