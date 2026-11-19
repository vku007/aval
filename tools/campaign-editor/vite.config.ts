import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { campaignEditorSavePlugin } from './src/io/savePlugin';

const root = path.dirname(fileURLToPath(import.meta.url));
const apiv2Src = path.resolve(root, '../../apiv2/src');
const apiv2Root = path.resolve(root, '../../apiv2');

/**
 * Imports under apiv2/src use a `.js` suffix for a `.ts` file. Vite rewrites
 * that inside this project and does not for files outside it.
 */
function apiv2JsToTs(): Plugin {
  return {
    name: 'apiv2-js-to-ts',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.endsWith('.js') || !importer) return null;
      const jsResolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      const jsFile = jsResolved?.id.split('?')[0];
      if (jsFile && fs.existsSync(jsFile)) return null;

      const tsResolved = await this.resolve(source.slice(0, -3) + '.ts', importer, {
        ...options,
        skipSelf: true
      });
      const tsFile = tsResolved?.id.split('?')[0];
      if (!tsResolved || !tsFile || !tsFile.startsWith(apiv2Src + path.sep)) return null;
      if (!fs.existsSync(tsFile)) return null;
      return tsResolved;
    }
  };
}

export default defineConfig({
  base: '/editor/',
  plugins: [campaignEditorSavePlugin(), apiv2JsToTs(), preact()],
  resolve: {
    alias: {
      '@apiv2': apiv2Src,
      // The editor does not install zod. Schema files import the copy in apiv2.
      zod: path.resolve(apiv2Root, 'node_modules/zod')
    },
    dedupe: ['zod']
  },
  server: {
    fs: {
      allow: [root, apiv2Root]
    }
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']]
  }
});
