/**
 * `dsh-latex-tools` namespace dictionaries, mirroring the harness locale
 * plugin's bilingual pattern (ui-deliverables): the zh dictionary is the
 * key-set source of truth, en carries the same keys, and the namespace is
 * registered through `ctx.locale.register(NS, { zh, en })`.
 */

/** Dictionary namespace owned by this plugin. */
export const NS = 'dsh-latex-tools'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'copy': '复制 LaTeX',
  'copyDone': '已复制',
  'svg': '导出 SVG',
  'svgBusy': '渲染中…',
  'svgDone': '已导出',
  'failed': '失败',
}

/** English dictionary (same key set). */
export const en: Record<LatexToolsKey, string> = {
  'copy': 'Copy LaTeX',
  'copyDone': 'Copied',
  'svg': 'Export SVG',
  'svgBusy': 'Rendering…',
  'svgDone': 'Exported',
  'failed': 'Failed',
}

/** Union of this namespace's dictionary keys. */
export type LatexToolsKey = keyof typeof zh
