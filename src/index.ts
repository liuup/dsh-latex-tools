/**
 * dsh-latex-tools host half — serves the MathJax es5 tex→svg bundle used by
 * the browser half's SVG export under /latex-tools/mathjax/*. The MathJax
 * script (~2.5 MB) is fetched lazily on the first export and cached by the
 * browser afterwards, so the always-loaded client bundle stays small and the
 * deployment works fully offline. Install via
 * `dsh plugin --profile web add link:<this package>`; the cordis.patch.yml
 * inserts this plugin row.
 * @module dsh-latex-tools
 */

import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Stable cordis plugin name (matches cordis.patch.yml insert id). */
export const name = 'latex-tools'

/** Services required before the asset route can be registered. */
export const inject = ['webServer']

/** Browser-facing base path of the MathJax asset route. */
export const MATHJAX_PREFIX = '/latex-tools/mathjax'

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

/**
 * Root of the installed mathjax package, resolved from this module's own
 * location: pnpm links the dependency into this package's node_modules, so
 * createRequire anchors against the plugin install, not the profile tree.
 * @param importMetaUrl - this module's `import.meta.url` (lib/index.js).
 * @returns the absolute mathjax package root directory.
 */
function mathjaxRoot(importMetaUrl: string): string {
  const require = createRequire(importMetaUrl)
  return dirname(require.resolve('mathjax/package.json'))
}

/**
 * Serve one GET/HEAD request from the mathjax package root. Traversal is
 * rejected (resolve + prefix check, the same guard the frontend-static
 * fallback uses); anything else outside the package is a 404.
 * @param req - the node:http request.
 * @param res - the node:http response.
 * @param root - absolute mathjax package root.
 */
export async function serveMathJaxAsset(
  req: IncomingMessage,
  res: ServerResponse,
  root: string,
): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    res.end()
    return
  }
  /* v8 ignore next -- node:http always sets url on server requests */
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
  const relative = pathname.slice(MATHJAX_PREFIX.length).replace(/^\/+/, '')
  if (relative === '') {
    res.writeHead(404)
    res.end()
    return
  }
  const target = resolve(normalize(join(root, relative)))
  if (target !== root && !target.startsWith(root + sep)) {
    res.writeHead(403)
    res.end()
    return
  }
  try {
    const body = await readFile(target)
    res.writeHead(200, {
      'content-type': MIME[extname(target)] ?? 'application/octet-stream',
      // The lazy script is cached for a day; a mathjax upgrade that changes
      // the file content is revalidated by the browser on expiry.
      'cache-control': 'public, max-age=86400',
    })
    res.end(body)
  } catch {
    res.writeHead(404)
    res.end()
  }
}

/**
 * Register the MathJax asset route on the context.
 * @param ctx - host context carrying the webServer service.
 */
export function apply(ctx: Context): void {
  const root = mathjaxRoot(import.meta.url)
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'prefix',
      path: MATHJAX_PREFIX,
      handler: (req, res) => serveMathJaxAsset(req, res, root),
    }),
    'latex-tools: mathjax assets',
  )
}
