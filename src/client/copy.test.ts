/**
 * Unit tests for TeX source extraction and clipboard copy.
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyText, texSourceOf } from './copy.ts'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  // jsdom defines no execCommand; the fallback tests install one.
  Reflect.deleteProperty(document, 'execCommand')
})

/** Build a `.katex` element shaped like the ui-primitives KaTeX output. */
function katexElement(source: string): HTMLElement {
  const katex = document.createElement('span')
  katex.className = 'katex'
  katex.innerHTML = `
    <span class="katex-mathml">
      <math><semantics><mrow></mrow>
        <annotation encoding="application/x-tex">${source}</annotation>
      </semantics></math>
    </span>
    <span class="katex-html"></span>`
  return katex
}

describe('texSourceOf', () => {
  it('extracts the source from the MathML annotation', () => {
    const katex = katexElement('\\frac{a}{b}')
    expect(texSourceOf(katex)).toBe('\\frac{a}{b}')
  })

  it('trims whitespace (fenced math appends a trailing newline)', () => {
    const katex = katexElement('  x^2 + y^2 = z^2\n')
    expect(texSourceOf(katex)).toBe('x^2 + y^2 = z^2')
  })

  it('falls back to the .katex-error text for parse failures', () => {
    const katex = document.createElement('span')
    katex.className = 'katex'
    katex.innerHTML = '<span class="katex-error" style="color:#cc0000">\\notmath{</span>'
    expect(texSourceOf(katex)).toBe('\\notmath{')
  })

  it('returns undefined for a node without any source arm', () => {
    expect(texSourceOf(document.createElement('span'))).toBeUndefined()
  })
})

describe('copyText', () => {
  it('uses navigator.clipboard when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    await expect(copyText('\\int_0^1 x\\,dx')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('\\int_0^1 x\\,dx')
  })

  it('falls back to execCommand when clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const execCommand = vi.fn(() => true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    await expect(copyText('e = mc^2')).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith('copy')
    // The helper textarea is removed afterwards.
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports failure when both paths fail', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    Object.defineProperty(document, 'execCommand', { value: vi.fn(() => false), configurable: true })
    await expect(copyText('x')).resolves.toBe(false)
  })
})
