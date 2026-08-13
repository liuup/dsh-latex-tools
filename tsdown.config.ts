/**
 * dsh-latex-tools build: two outputs, one package.
 *
 * - The node half (lib/index.js, ESM): serves the MathJax es5 bundle under
 *   /dsh-latex-tools/mathjax. cordis and the dsh peer packages resolve at runtime
 *   from the profile tree, so they stay external.
 * - The browser half (lib/client.js): a closure-factory artifact that calls
 *   window.__ModuleLoader__.load({ id, factory }) and resolves platform
 *   modules through the injected require (the shell's frozen module table —
 *   see packages/client/web/src/platform.ts). Everything else is inlined, so
 *   the always-loaded bundle carries no MathJax weight.
 */
import type { UserConfig } from 'tsdown'

/** The shell's shared module table; client bundles resolve these at runtime. */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
] as const

export default (): UserConfig[] => [
  {
    name: 'dsh-latex-tools',
    entry: ['src/index.ts'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    dts: false,
    clean: false,
    fixedExtension: false,
    // cordis + dsh peer packages resolve at runtime from the profile tree.
    deps: { neverBundle: [/^@deepseek-ai\//] },
  },
  {
    name: 'dsh-latex-tools/client',
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    dts: false,
    clean: false,
    sourcemap: true,
    // Platform modules resolve from the shell's frozen module table at runtime.
    deps: { neverBundle: [...PLATFORM_MODULES] },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: 'window.__ModuleLoader__.load({ id: "dsh-latex-tools", factory: (require) => {',
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
