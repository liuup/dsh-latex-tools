/**
 * Tests for the hover toolbar: show/hide behavior, copy action, and SVG
 * export with a stubbed MathJax script load.
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installLatexToolbar } from './toolbar.ts'

/** KaTeX-shaped formula DOM: block display wrapper + inner .katex. */
function formulaDom(source = 'x^2'): { container: HTMLElement; katex: HTMLElement } {
  const container = document.createElement('div')
  container.innerHTML = `
    <span class="katex-display"><span class="katex">
      <span class="katex-mathml"><math><semantics><mrow></mrow>
        <annotation encoding="application/x-tex">${source}</annotation>
      </semantics></math></span>
      <span class="katex-html"></span>
    </span></span>`
  document.body.append(container)
  return { container, katex: container.querySelector('.katex') as HTMLElement }
}

function pointerOver(target: Node, relatedTarget: Node | null = null): void {
  target.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, relatedTarget }))
}

function pointerOut(target: Node, relatedTarget: Node | null = null): void {
  target.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget }))
}

const barElement = (): HTMLDivElement | null =>
  document.getElementById('dsh-latex-tools-bar') as HTMLDivElement | null

let dispose: (() => void) | undefined
let anchorClick: ReturnType<typeof vi.spyOn> | undefined

beforeEach(() => {
  dispose = installLatexToolbar()
})

afterEach(() => {
  dispose?.()
  anchorClick?.mockRestore()
  anchorClick = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  // jsdom has no blob URLs; remove the stubs the svg tests install.
  Reflect.deleteProperty(URL, 'createObjectURL')
  Reflect.deleteProperty(URL, 'revokeObjectURL')
})

describe('toolbar visibility', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('shows a positioned toolbar when hovering a formula and hides on leave', () => {
    const { katex } = formulaDom()
    pointerOver(katex)
    const bar = barElement()
    expect(bar).not.toBeNull()
    expect(bar?.style.display).toBe('flex')
    expect(bar?.style.left).toMatch(/\d+px/)
    expect(bar?.style.top).toMatch(/\d+px/)

    pointerOut(katex, document.body) // real leave: relatedTarget is known
    vi.advanceTimersByTime(300)
    expect(bar?.style.display).toBe('none')
  })

  it('keeps the bar through the unknown-target grace, then hides', () => {
    const { katex } = formulaDom()
    pointerOver(katex)
    // Synthetic pointer streams may leave relatedTarget null.
    pointerOut(katex)
    vi.advanceTimersByTime(300)
    expect(barElement()?.style.display).toBe('flex')
    vi.advanceTimersByTime(2100)
    expect(barElement()?.style.display).toBe('none')
  })

  it('does not flicker when the pointer moves within the formula', () => {
    const { katex } = formulaDom()
    const inner = katex.querySelector('.katex-html') as HTMLElement
    pointerOver(inner)
    pointerOut(inner, katex) // moving to a sibling inside the same formula
    vi.advanceTimersByTime(300)
    expect(barElement()?.style.display).toBe('flex')
  })

  it('stays open while the pointer is on the toolbar', () => {
    const { katex } = formulaDom()
    pointerOver(katex)
    const bar = barElement()!
    pointerOut(katex, bar)
    vi.advanceTimersByTime(300)
    expect(bar.style.display).toBe('flex')
    // Leaving the toolbar (not onto the formula) hides it.
    pointerOut(bar, document.body)
    vi.advanceTimersByTime(300)
    expect(bar.style.display).toBe('none')
  })

  it('survives the gap transition: pointerout then entering the toolbar cancels the hide', () => {
    const { katex } = formulaDom()
    pointerOver(katex)
    const bar = barElement()!
    // Moving up toward the bar crosses the gap: pointerout fires with an
    // unrelated (or null) relatedTarget, scheduling a hide...
    pointerOut(katex)
    vi.advanceTimersByTime(100)
    expect(bar.style.display).toBe('flex')
    // ...then the pointer lands on the toolbar: the hide must be cancelled.
    pointerOver(bar)
    vi.advanceTimersByTime(400)
    expect(bar.style.display).toBe('flex')
  })

  it('hides on scroll', () => {
    const { katex } = formulaDom()
    pointerOver(katex)
    window.dispatchEvent(new Event('scroll'))
    expect(barElement()?.style.display).toBe('none')
  })

  it('unmounts everything on dispose', () => {
    dispose?.()
    dispose = undefined
    expect(barElement()).toBeNull()
    expect(document.getElementById('dsh-latex-tools-style')).toBeNull()
    const { katex } = formulaDom()
    pointerOver(katex)
    expect(barElement()).toBeNull()
  })
})

describe('copy action', () => {
  it('copies the TeX source and flashes feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { katex } = formulaDom('\\int_0^\\infty e^{-x}\\,dx')
    pointerOver(katex)
    const copyButton = barElement()!.querySelector('button') as HTMLButtonElement
    copyButton.click()
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('\\int_0^\\infty e^{-x}\\,dx')
      expect(copyButton.dataset.state).toBe('done')
    })
  })
})

describe('svg export', () => {
  /** Stub the lazy MathJax script load: capture the created script's load handler. */
  function stubMathJaxLoad(): { tex2svgPromise: ReturnType<typeof vi.fn>; fireLoad: () => void } {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    const tex2svgPromise = vi.fn().mockResolvedValue(svg)
    let loadHandler: (() => void) | undefined
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = realCreate(tag)
      if (tag === 'script') {
        const original = element.addEventListener.bind(element)
        element.addEventListener = ((type: string, cb: EventListenerOrEventListenerObject) => {
          if (type === 'load') loadHandler = cb as () => void
          return original(type, cb)
        }) as typeof element.addEventListener
      }
      return element
    })
    return {
      tex2svgPromise,
      fireLoad: () => {
        // The real script defines window.MathJax before firing load.
        Object.defineProperty(window, 'MathJax', { value: { tex2svgPromise }, configurable: true })
        loadHandler?.()
      },
    }
  }

  /** jsdom has no blob URLs; install the minimum surface svg.ts touches. */
  function stubBlobUrls(): void {
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock'), configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
  }

  it('exports a display-mode SVG download on button click', async () => {
    const { tex2svgPromise, fireLoad } = stubMathJaxLoad()
    stubBlobUrls()
    const downloads: string[] = []
    anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    const { katex } = formulaDom('E = mc^2')
    pointerOver(katex)
    const svgButton = barElement()!.querySelectorAll('button')[1] as HTMLButtonElement

    svgButton.click()
    expect(svgButton.dataset.state).toBe('busy')
    fireLoad()
    await vi.waitFor(() => {
      expect(tex2svgPromise).toHaveBeenCalledWith('E = mc^2', { display: true })
      expect(downloads).toEqual(['formula-E-mc-2.svg'])
      expect(svgButton.dataset.state).toBe('done')
    })
  })

  it('reports failure when MathJax cannot render', async () => {
    stubBlobUrls()
    // MathJax "already loaded": the render rejects immediately, no script involved.
    Object.defineProperty(window, 'MathJax', {
      value: { tex2svgPromise: vi.fn().mockRejectedValue(new Error('parse error')) },
      configurable: true,
    })
    const { katex } = formulaDom('x')
    pointerOver(katex)
    const svgButton = barElement()!.querySelectorAll('button')[1] as HTMLButtonElement
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    svgButton.click()
    await vi.waitFor(() => expect(svgButton.dataset.state).toBe('error'))
    expect(errorSpy).toHaveBeenCalled()
  })
})
