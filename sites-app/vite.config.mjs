import { defineConfig } from "vite";
import {createHmac,randomUUID} from 'node:crypto';
import react from "@vitejs/plugin-react";
import { createLocalEnvironment } from './scripts/local-environment.mjs';
import { handleArchive } from './worker/archive.js';
const archivePlugin={name:'archive-local-api',configureServer(server){const env=createLocalEnvironment(process.cwd());server.middlewares.use(async(req,res,next)=>{if(!req.url?.startsWith('/api/')&&!req.url?.startsWith('/media/'))return next();try{const chunks=[];for await(const c of req)chunks.push(c);const body=Buffer.concat(chunks);const previewPayload=(Date.now()+86400000)+'.'+randomUUID();const previewSignature=createHmac('sha256',env.SESSION_SECRET).update(previewPayload).digest('hex');const previewHeaders={...req.headers,cookie:'archive_session='+previewPayload+'.'+previewSignature};const request=new Request('http://'+(req.headers.host||'terminal.local')+req.url,{method:req.method,headers:previewHeaders,...(['GET','HEAD'].includes(req.method)?{}:{body,duplex:'half'})});const result=await handleArchive(request,env);if(!result)return next();res.statusCode=result.status;for(const [k,v]of result.headers)res.setHeader(k,v);res.end(Buffer.from(await result.arrayBuffer()));}catch(e){console.error(e);res.statusCode=500;res.end(JSON.stringify({error:'预览暂时不可用'}));}})}};

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react(),archivePlugin],
});
