import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const functions = process.argv[2] 
  ? [process.argv[2]] 
  : ['pre-signup', 'post-confirmation', 'pre-token-generation'];

const buildFunction = async (functionName) => {
  try {
    // Create a directory for each function
    const outdir = join(__dirname, 'dist', functionName);
    
    await esbuild.build({
      entryPoints: [join(__dirname, 'src', `${functionName}.ts`)],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: join(outdir, 'index.js'),  // Always output as index.js
      external: ['@aws-sdk/*'],
      format: 'cjs',
      sourcemap: true,
      minify: true,
      metafile: true,
    });
    console.log(`✅ Built ${functionName}`);
  } catch (error) {
    console.error(`❌ Failed to build ${functionName}:`, error);
    process.exit(1);
  }
};

// Build all functions
Promise.all(functions.map(buildFunction))
  .then(() => {
    console.log('✅ All functions built successfully');
  })
  .catch((error) => {
    console.error('❌ Build failed:', error);
    process.exit(1);
  });

