import { describe, it, expect } from 'vitest'
import { ctx, env, hasRealKey } from '../_test-helpers'
import { endpoints } from '.'

const skip = !hasRealKey('LATEX_COMPILER_URL')

describe('LaTeX Compiler', () => {
  // Billing verification tests — always run
  it('billing: compile costs $0.005 per request', () => {
    expect(endpoints['latex-compiler/compile'].billing.baseCost).toBe(0.005)
    expect(endpoints['latex-compiler/compile'].billing.currency).toBe('USD')
    expect(endpoints['latex-compiler/compile'].billing.model).toBe('per_request')
  })

  it('billing: handler is defined', () => {
    expect(typeof endpoints['latex-compiler/compile'].handler).toBe('function')
  })

  // API tests — require a real compiler URL
  it.skipIf(skip)('compiles a simple LaTeX document', async () => {
    const result = await endpoints['latex-compiler/compile'].handler(
      env as any,
      {
        compiler: 'pdflatex',
        document: '\\documentclass{article}\n\\begin{document}\nHello, World!\n\\end{document}',
      },
      ctx,
    ) as any
    expect(result).toHaveProperty('compiled')
    expect(result.compiled).toBe(true)
    expect(result).toHaveProperty('pdfBase64')
    expect(typeof result.pdfBase64).toBe('string')
  }, 60000)

  it.skipIf(skip)('compiles with multi-file resources', async () => {
    const result = await endpoints['latex-compiler/compile'].handler(
      env as any,
      {
        compiler: 'pdflatex',
        resources: [
          {
            main: true,
            content: '\\documentclass{article}\n\\begin{document}\nTest document.\n\\end{document}',
          },
        ],
      },
      ctx,
    ) as any
    expect(result).toHaveProperty('compiled')
    expect(result.compiled).toBe(true)
  }, 60000)
})
