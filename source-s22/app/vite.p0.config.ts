/** Test-only multipage build. Historical index.html and sources are unchanged. */
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';
export default defineConfig({
  plugins:[react()],
  base:'./',
  build:{outDir:'dist-p0-test',assetsDir:'assets',sourcemap:false,
    rollupOptions:{input:{legacy:resolve(__dirname,'index.html'),
      gatewayJourney:resolve(__dirname,'jornada-servidor.html')}}}
});
