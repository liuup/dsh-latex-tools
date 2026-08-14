/**
 * dsh-latex-tools browser half: a hover toolbar over rendered LaTeX formulas
 * that copies the TeX source or exports the formula as a standalone SVG.
 *
 * Everything lives in the DOM — the `.katex` elements the app's own KaTeX
 * renderer already produced — so this plugin composes out cleanly and never
 * touches the markdown pipeline. The SVG engine (MathJax es5) is served by
 * this package's host half under /dsh-latex-tools/mathjax and fetched lazily on
 * the first export; the always-loaded bundle carries no MathJax weight.
 * Toolbar labels are localized through the harness locale service (zh/en)
 * and follow live locale switches.
 * Install via `dsh plugin --profile web add link:<this package>`; the
 * cordis.patch.yml inserts the plugin row, and the modules node half scans
 * this package's dsh.client declaration into the web plugin roster.
 * @module dsh-latex-tools/client
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { installLatexToolbar, refreshToolbarLabels } from './toolbar.ts'
import { en, NS, zh, type LatexToolsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Formula toolbar copy (buttons + feedback). */
    'dsh-latex-tools': LatexToolsKey
  }
}

export { installLatexToolbar, refreshToolbarLabels } from './toolbar.ts'
export { texSourceOf } from './copy.ts'
export { en, NS, zh, type LatexToolsKey } from './locales.ts'

/** Required services for the toolbar and its dictionaries. */
export const inject = ['locale']

/**
 * Client plugin body: register the dictionaries, then mount the formula
 * hover toolbar for the lifetime of this fiber (HMR unload disposes it
 * through the effect).
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-latex-tools: dictionaries')
  ctx.effect(() => {
    const dispose = installLatexToolbar(ctx.locale.bind(NS))
    // Locale switch (or late dictionary registration): refresh the labels of
    // a toolbar that is currently visible.
    const unsubscribe = ctx.locale.subscribe(refreshToolbarLabels)
    return () => {
      unsubscribe()
      dispose()
    }
  }, 'dsh-latex-tools: formula toolbar')
}
