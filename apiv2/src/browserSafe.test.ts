import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EDITOR_ENTRIES = [
  'src/domain/campaign/ChapterSettingsSchema.ts',
  'src/domain/campaign/ChapterDefinitionBuilder.ts',
  'src/domain/campaign/Campaign.ts',
  'src/application/campaign/BattleSimulator.ts'
] as const;

const FORBIDDEN_INPUT = ['node_modules/@aws-sdk', '/infrastructure/', '/config/'] as const;

const NODE_IMPORT = /['"]node:/;

interface BrowserGuardFinding {
  kind: 'build' | 'input' | 'output';
  detail: string;
}

function formatFailure(error: unknown): string {
  if (error && typeof error === 'object' && 'errors' in error) {
    const errors = (error as { errors: { text?: string }[] }).errors;
    const text = errors.map(entry => entry.text).filter(Boolean).join('; ');
    if (text) {
      return text;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

/** `write: false` still requires an output name; the file is not written. */
async function browserGuard(entry: string): Promise<BrowserGuardFinding[]> {
  let outputText = '';
  let inputs: string[] = [];
  try {
    const result = await build({
      absWorkingDir: packageRoot,
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      outfile: 'browser-safe-check.mjs',
      write: false,
      metafile: true,
      logLevel: 'silent'
    });
    outputText = result.outputFiles?.map(file => file.text).join('\n') ?? '';
    inputs = Object.keys(result.metafile?.inputs ?? {});
  } catch (error) {
    return [{ kind: 'build', detail: formatFailure(error) }];
  }

  const findings: BrowserGuardFinding[] = [];
  for (const input of inputs) {
    for (const needle of FORBIDDEN_INPUT) {
      if (input.includes(needle)) {
        findings.push({ kind: 'input', detail: `${input} contains ${needle}` });
      }
    }
  }
  if (outputText.includes('process.env')) {
    findings.push({ kind: 'output', detail: 'output contains process.env' });
  }
  if (NODE_IMPORT.test(outputText)) {
    findings.push({ kind: 'output', detail: 'output contains a node: import' });
  }
  return findings;
}

describe('browser guard', () => {
  it.each(EDITOR_ENTRIES)('bundles %s for the browser', async (entry) => {
    expect(await browserGuard(entry)).toEqual([]);
  });

  it('reports config/environment.ts', async () => {
    const findings = await browserGuard('src/config/environment.ts');
    expect(findings.some(finding => finding.detail.includes('/config/'))).toBe(true);
    expect(findings.some(finding => finding.detail.includes('process.env'))).toBe(true);
  });
});
