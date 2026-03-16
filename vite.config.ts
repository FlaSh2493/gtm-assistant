import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { mkdirSync } from 'fs';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';

const _require = createRequire(import.meta.url);
// esbuild는 Vite의 내부 의존성이므로 타입 선언 없이 require로 로드
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const esbuildLib = _require('esbuild') as any;
const __dirname = dirname(fileURLToPath(import.meta.url));

// esbuild를 직접 사용해 webview-preload를 신뢰할 수 있는 CJS로 빌드하는 플러그인.
// vite-plugin-electron이 내부 SSR 모드에서 external electron을
// require() 대신 import 구문으로 출력하는 문제를 우회합니다.
function webviewPreloadPlugin(): Plugin {
  const esbuildOptions: import('esbuild').BuildOptions = {
    entryPoints: ['src/preload/webview-preload.ts'],
    bundle: true,
    platform: 'node',
    external: ['electron'],
    outfile: 'dist-preload/webview-preload.cjs',
    format: 'cjs',
  };

  return {
    name: 'webview-preload-esbuild',
    async buildStart() {
      mkdirSync('dist-preload', { recursive: true });
      await esbuildLib.build(esbuildOptions);
      console.log('✓ dist-preload/webview-preload.cjs built');
    },
    async watchChange(id) {
      if (id.includes('src/preload/webview-preload')) {
        await esbuildLib.build(esbuildOptions);
        console.log('✓ dist-preload/webview-preload.cjs rebuilt');
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    webviewPreloadPlugin(),
    electron([
      {
        entry: 'src/main/index.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-main',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'es',
                entryFileNames: 'index.mjs',
              },
            },
          },
        },
      },
      {
        entry: 'src/preload/index.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-preload',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'es',
                entryFileNames: 'index.mjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-renderer',
  },
});
