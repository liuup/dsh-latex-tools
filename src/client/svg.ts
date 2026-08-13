/**
 * SVG export for one formula: lazily loads the MathJax es5 tex→svg bundle
 * from the plugin's own HTTP route (served by the host half — never the CDN,
 * so the deployment stays offline) and serializes the rendered SVG into a
 * standalone file download.
 *
 * MathJax SVG output embeds glyph outlines as path data, so the exported file
 * is self-contained: no font files, no CSS, renders anywhere SVG does.
 */

/** The MathJax es5 component the host half serves (see src/index.ts). */
const MATHJAX_SCRIPT_URL = '/dsh-latex-tools/mathjax/es5/tex-svg.js'

/** Minimal surface of the MathJax v3 es5 global used here. */
interface MathJaxApi {
  tex2svgPromise(source: string, options: { display: boolean }): Promise<Element>
}

declare global {
  interface Window {
    MathJax?: MathJaxApi
  }
}

let loading: Promise<MathJaxApi> | undefined

/**
 * Fetch the MathJax script once and cache the promise; concurrent exports
 * share the in-flight load.
 * @returns the MathJax global once the script has executed.
 */
function loadMathJax(): Promise<MathJaxApi> {
  if (window.MathJax !== undefined) return Promise.resolve(window.MathJax)
  if (loading === undefined) {
    loading = new Promise((resolvePromise, reject) => {
      const script = document.createElement('script')
      script.src = MATHJAX_SCRIPT_URL
      script.async = true
      script.addEventListener('load', () => {
        const mathjax = window.MathJax
        if (mathjax === undefined) {
          loading = undefined
          reject(new Error(`dsh-latex-tools: ${MATHJAX_SCRIPT_URL} loaded without defining window.MathJax`))
          return
        }
        resolvePromise(mathjax)
      }, { once: true })
      script.addEventListener('error', () => {
        loading = undefined
        reject(new Error(`dsh-latex-tools: failed to load ${MATHJAX_SCRIPT_URL}`))
      }, { once: true })
      document.head.append(script)
    })
  }
  return loading
}

/** Short filename-safe slug of the TeX source (empty when it is all symbols). */
function slugOf(tex: string): string {
  return tex
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/**
 * Render one formula with MathJax and download the result as a standalone
 * SVG file.
 * @param tex - the TeX source.
 * @param display - display (block) mode vs inline mode.
 */
export async function exportFormulaSvg(tex: string, display: boolean): Promise<void> {
  const mathjax = await loadMathJax()
  const rendered = await mathjax.tex2svgPromise(tex, { display })
  // tex2svgPromise resolves to the <svg> root itself; be defensive about a
  // wrapper element in future MathJax releases.
  const svg = rendered instanceof SVGElement
    ? rendered
    : rendered.querySelector('svg')
  if (svg === null) throw new Error('dsh-latex-tools: MathJax produced no <svg> element')
  // A standalone file needs both namespaces even when the in-DOM root omits
  // them (MathJax emits them for standalone use; setAttribute is idempotent).
  if (!svg.hasAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  if (!svg.hasAttribute('xmlns:xlink')) svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink')
  const xml = new XMLSerializer().serializeToString(svg)
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `formula${slugOf(tex) === '' ? '' : `-${slugOf(tex)}`}.svg`
  document.body.append(link)
  link.click()
  link.remove()
  // Keep the blob alive long enough for the download to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
