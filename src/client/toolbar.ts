/**
 * Floating hover toolbar for rendered LaTeX formulas.
 *
 * Pure DOM enhancement, no React coupling: a document-level pointerover/out
 * delegation finds the `.katex` element under the pointer (KaTeX output from
 * ui-primitives — the same DOM the app renders), and a fixed-position pill
 * with "复制 LaTeX" / "导出 SVG" buttons floats above it. Because nothing is
 * attached to individual elements, streaming renders and React re-renders
 * need no bookkeeping. The toolbar hides on scroll, on an outside click, and
 * when the pointer leaves the formula (with a grace period so moving onto
 * the bar itself does not flicker it away).
 */

import { copyText, texSourceOf } from './copy.ts'
import { exportFormulaSvg } from './svg.ts'

const STYLE_ID = 'dsh-latex-tools-style'
const BAR_ID = 'dsh-latex-tools-bar'
const PLUGIN_ID = 'dsh-latex-tools'

const COPY_LABEL = '复制 LaTeX'
const SVG_LABEL = '导出 SVG'
const COPIED_LABEL = '已复制'
const SVG_BUSY_LABEL = '渲染中…'
const SVG_DONE_LABEL = '已导出'
const FAILED_LABEL = '失败'
const HIDE_GRACE_MS = 250
// Synthetic pointer streams (automation, some browser drivers) dispatch
// pointerout without a matching pointerover, leaving relatedTarget null.
// Keep the bar long enough for the follow-up hover/click to cancel the hide.
const HIDE_GRACE_UNKNOWN_MS = 2000
const FEEDBACK_MS = 1400

const TOOLBAR_CSS = `
.dsh-latex-tools-bar {
  position: fixed;
  z-index: 2147483647;
  display: none;
  align-items: center;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: rgba(24, 24, 27, 0.92);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(6px);
  font: 12px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif;
  user-select: none;
}
.dsh-latex-tools-bar button {
  appearance: none;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fafafa;
  padding: 4px 10px;
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}
.dsh-latex-tools-bar button:hover { background: rgba(255, 255, 255, 0.14); }
.dsh-latex-tools-bar button[data-state='busy'] { color: #fbbf24; }
/* DeepSeek brand blue (design-platform.css --dsw-static-deepseek-500), with a literal fallback. */
.dsh-latex-tools-bar button[data-state='done'] { color: var(--dsw-static-deepseek-500, #4176e6); }
.dsh-latex-tools-bar button[data-state='error'] { color: #f87171; }
`

interface Toolbar {
  el: HTMLDivElement
  copyButton: HTMLButtonElement
  svgButton: HTMLButtonElement
}

let bar: Toolbar | undefined
let activeKatex: HTMLElement | undefined
let hideTimer: number | undefined
let restoreTimer: number | undefined

/** Inject the toolbar stylesheet once (tagged for the loader's style bookkeeping). */
function injectStyles(): void {
  if (document.getElementById(STYLE_ID) !== null) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.dataset.plugin = PLUGIN_ID
  style.textContent = TOOLBAR_CSS
  document.head.append(style)
}

/** Create the bar element on first hover (buttons are click-bound once here). */
function ensureBar(): Toolbar {
  if (bar !== undefined) return bar
  const el = document.createElement('div')
  el.id = BAR_ID
  el.className = 'dsh-latex-tools-bar'
  el.setAttribute('role', 'toolbar')
  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = COPY_LABEL
  copyButton.addEventListener('click', onCopyClick)
  const svgButton = document.createElement('button')
  svgButton.type = 'button'
  svgButton.textContent = SVG_LABEL
  svgButton.addEventListener('click', onSvgClick)
  el.append(copyButton, svgButton)
  document.body.append(el)
  bar = { el, copyButton, svgButton }
  return bar
}

/** Reset button labels so a previous flash feedback does not linger. */
function resetButtons(): void {
  if (bar === undefined) return
  bar.copyButton.textContent = COPY_LABEL
  bar.copyButton.dataset.state = ''
  bar.svgButton.textContent = SVG_LABEL
  bar.svgButton.dataset.state = ''
}

/** Position the bar above the formula (below it when the formula is near the top). */
function positionBar(katex: HTMLElement): void {
  const toolbar = ensureBar()
  resetButtons()
  toolbar.el.style.display = 'flex'
  const rect = katex.getBoundingClientRect()
  const width = toolbar.el.offsetWidth
  const height = toolbar.el.offsetHeight
  const left = Math.max(8, Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width - 8))
  let top = rect.top - height - 8
  if (top < 8) top = rect.bottom + 8
  toolbar.el.style.left = `${left}px`
  toolbar.el.style.top = `${top}px`
}

function showBar(katex: HTMLElement): void {
  activeKatex = katex
  positionBar(katex)
}

function hideBar(): void {
  clearHideTimer()
  if (restoreTimer !== undefined) {
    window.clearTimeout(restoreTimer)
    restoreTimer = undefined
  }
  activeKatex = undefined
  if (bar !== undefined) bar.el.style.display = 'none'
}

function scheduleHide(graceMs: number = HIDE_GRACE_MS): void {
  clearHideTimer()
  hideTimer = window.setTimeout(hideBar, graceMs)
}

function clearHideTimer(): void {
  if (hideTimer !== undefined) {
    window.clearTimeout(hideTimer)
    hideTimer = undefined
  }
}

/** Swap one button to a transient feedback label/state, then reset. */
function flash(button: HTMLButtonElement, label: string, state: 'busy' | 'done' | 'error'): void {
  button.textContent = label
  button.dataset.state = state
  if (restoreTimer !== undefined) window.clearTimeout(restoreTimer)
  restoreTimer = window.setTimeout(() => {
    restoreTimer = undefined
    resetButtons()
  }, FEEDBACK_MS)
}

function onCopyClick(): void {
  clearHideTimer()
  const button = bar?.copyButton
  const source = activeKatex === undefined ? undefined : texSourceOf(activeKatex)
  if (button === undefined) return
  if (source === undefined) {
    flash(button, FAILED_LABEL, 'error')
    return
  }
  void copyText(source).then((ok) => {
    flash(button, ok ? COPIED_LABEL : FAILED_LABEL, ok ? 'done' : 'error')
  })
}

function onSvgClick(): void {
  clearHideTimer()
  const button = bar?.svgButton
  const katex = activeKatex
  const source = katex === undefined ? undefined : texSourceOf(katex)
  if (button === undefined) return
  if (source === undefined) {
    flash(button, FAILED_LABEL, 'error')
    return
  }
  const display = katex !== undefined && katex.closest('.katex-display') !== null
  flash(button, SVG_BUSY_LABEL, 'busy')
  exportFormulaSvg(source, display).then(
    () => flash(button, SVG_DONE_LABEL, 'done'),
    (error: unknown) => {
      console.error('[dsh-latex-tools] svg export failed:', error)
      flash(button, FAILED_LABEL, 'error')
    },
  )
}

function onPointerOver(event: PointerEvent): void {
  // Over the toolbar itself: keep it up (it sits above the formula). The
  // pointer crosses a small gap between the formula and the bar first, and
  // the pointerout fired there must not win — cancel any pending hide.
  if (bar !== undefined && bar.el.contains(event.target as Node)) {
    clearHideTimer()
    return
  }
  const katex = (event.target as Element).closest<HTMLElement>('.katex')
  if (katex === null) return
  clearHideTimer()
  // Detached node (React replaced it mid-hover): re-anchor to the live one.
  if (!document.contains(katex)) return
  if (activeKatex !== katex) showBar(katex)
}

function onPointerOut(event: PointerEvent): void {
  const target = event.target as Node
  const related = event.relatedTarget as Node | null
  // Left the toolbar: keep it while the pointer is over the formula.
  if (bar !== undefined && bar.el.contains(target)) {
    if (activeKatex !== undefined && related !== null && activeKatex.contains(related)) return
    scheduleHide(related === null ? HIDE_GRACE_UNKNOWN_MS : HIDE_GRACE_MS)
    return
  }
  const katex = (target as Element).closest<HTMLElement>('.katex')
  if (katex === null) return
  // Moving within the formula or onto the toolbar: stay.
  if (related !== null && katex.contains(related)) return
  if (bar !== undefined && related !== null && bar.el.contains(related)) return
  scheduleHide(related === null ? HIDE_GRACE_UNKNOWN_MS : HIDE_GRACE_MS)
}

function onScroll(): void {
  if (activeKatex !== undefined) hideBar()
}

function onPointerDown(event: PointerEvent): void {
  if (bar === undefined) return
  if (bar.el.contains(event.target as Node)) {
    // Pointer is confirmed on the toolbar: a click is coming, so cancel any
    // hide scheduled by an earlier pointerout (synthetic event streams may
    // leave relatedTarget null, which would otherwise vanish the toolbar
    // mid-click).
    clearHideTimer()
    return
  }
  hideBar()
}

/**
 * Mount the formula hover toolbar on the page.
 * @returns the disposer (unmounts the toolbar and its listeners).
 */
export function installLatexToolbar(): () => void {
  injectStyles()
  document.addEventListener('pointerover', onPointerOver, true)
  document.addEventListener('pointerout', onPointerOut, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('scroll', onScroll, true)
  return () => {
    document.removeEventListener('pointerover', onPointerOver, true)
    document.removeEventListener('pointerout', onPointerOut, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('scroll', onScroll, true)
    clearHideTimer()
    if (restoreTimer !== undefined) {
      window.clearTimeout(restoreTimer)
      restoreTimer = undefined
    }
    bar?.el.remove()
    bar = undefined
    activeKatex = undefined
    document.getElementById(STYLE_ID)?.remove()
  }
}
