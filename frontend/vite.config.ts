import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig, loadEnv} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function copyPdfjsAssets() {
  const copy = () => {
    const sourceRoot = path.resolve(rootDir, 'node_modules/pdfjs-dist');
    const destRoot = path.resolve(rootDir, 'public/pdfjs');
    for (const dir of ['standard_fonts', 'cmaps'] as const) {
      const from = path.join(sourceRoot, dir);
      if (!fs.existsSync(from)) continue;
      fs.cpSync(from, path.join(destRoot, dir), {recursive: true});
    }
  };
  return {
    name: 'copy-pdfjs-assets',
    buildStart: copy,
    configureServer() {
      copy();
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [copyPdfjsAssets(), react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL ?? 'http://localhost:8000/api/v1'),
    },
    resolve: {
      alias: {
        '@': path.resolve(rootDir, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      headers: {
        'Permissions-Policy':
          'camera=*, microphone=*, geolocation=*, display-capture=*',
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: {
        usePolling: process.env.CHOKIDAR_USEPOLLING === 'true',
      },
    },
  };
});
