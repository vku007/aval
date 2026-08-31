import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildFunction = async () => {
  try {
    await esbuild.build({
      entryPoints: [join(__dirname, 'src', 'viewer-request.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: join(__dirname, 'dist', 'viewer-request.js'),
      format: 'cjs',
      sourcemap: true,
      minify: true,
      metafile: true,
    });
    console.log('✅ Built viewer-request');
  } catch (error) {
    console.error('❌ Failed to build viewer-request:', error);
    process.exit(1);
  }
};

buildFunction();

