/**
 * dsh-latex-tools browser half: a hover toolbar over rendered LaTeX formulas
 * that copies the TeX source or exports the formula as a standalone SVG.
 *
 * Everything lives in the DOM — the `.katex` elements the app's own KaTeX
 * renderer already produced — so this plugin composes out cleanly and never
 * touches the markdown pipeline. The SVG engine (MathJax es5) is served by
 * this package's host half under /dsh-latex-tools/mathjax and fetched lazily on
 * the first export; the always-loaded bundle carries no MathJax weight.
 * Install via `dsh plugin --profile web add link:<this package>`; the
 * cordis.patch.yml inserts the plugin row, and the modules node half scans
 * this package's dsh.client declaration into the web plugin roster.
 * @module dsh-latex-tools/client
 */

import type { Context } from '@deepseek-ai/cordis'
import { installLatexToolbar } from './toolbar.ts'

export { installLatexToolbar } from './toolbar.ts'
export { texSourceOf } from './copy.ts'

/**
 * Client plugin body: mount the formula hover toolbar for the lifetime of
 * this fiber (HMR unload disposes it through the effect).
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => installLatexToolbar(), 'dsh-latex-tools: formula toolbar')
}
