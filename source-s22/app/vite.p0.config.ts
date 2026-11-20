/** F3 P0 test-only multi-page build and local PG17 proxy. Never use in production. */
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({
  plugins:[react()],base:'./',
  server:{host:'127.0.0.1',port:4177,strictPort:true,
    proxy:{'/api/v1/exam':{target:'http://127.0.0.1:8788',changeOrigin:false}}},
  build:{outDir:'dist-p0-test',assetsDir:'assets',sourcemap:false,
    rollupOptions:{input:{legacy:resolve(__dirname,'index.html'),
      gatewayJourney:resolve(__dirname,'jornada-servidor.html')}}}
});
