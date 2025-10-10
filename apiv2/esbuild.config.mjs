import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.mjs",
  sourcemap: true,
  sourcesContent: false,
  legalComments: "none",
  logLevel: "info",
  banner: { js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);' }
});
