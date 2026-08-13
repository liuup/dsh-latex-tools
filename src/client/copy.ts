/**
 * TeX source extraction and clipboard helpers for the hover toolbar.
 *
 * KaTeX renders every formula as a `.katex` span whose MathML arm carries the
 * original source in `<annotation encoding="application/x-tex">` — the
 * ui-primitives markdown tests assert exactly that shape. Parse failures
 * (`.katex-error`) keep the raw source as their text, which is the fallback.
 */

/**
 * Extract the TeX source of one rendered formula.
 * @param katex - the `.katex` element under the pointer.
 * @returns the source, or undefined when the element has no MathML annotation
 * (defensive: a non-KaTeX `.katex`-classed node).
 */
export function texSourceOf(katex: HTMLElement): string | undefined {
  const annotation = katex.querySelector<HTMLElement>('.katex-mathml annotation')
  const source = annotation?.textContent?.trim()
  if (source) return source
  const error = katex.querySelector<HTMLElement>('.katex-error')
  return error?.textContent?.trim() || undefined
}

/**
 * Copy text to the clipboard. `navigator.clipboard` needs a secure context
 * (https or loopback); LAN deployments of the web UI may not be one, so a
 * hidden-textarea `execCommand('copy')` fallback covers that case.
 * @param text - the text to copy.
 * @returns whether the copy succeeded.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText !== undefined) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the legacy path (permission denied, non-secure context).
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  // Off-screen and invisible, but focusable/selectable.
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  textarea.remove()
  return ok
}
