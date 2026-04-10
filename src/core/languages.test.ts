import { describe, it, expect } from 'vitest'
import { detectLanguage } from './languages.js'

describe('detectLanguage', () => {
  it.each([
    ['file.ts', 'typescript'],
    ['file.tsx', 'tsx'],
    ['file.js', 'javascript'],
    ['file.jsx', 'jsx'],
    ['file.py', 'python'],
    ['file.java', 'java'],
    ['file.kt', 'kotlin'],
    ['file.kts', 'kotlin'],
  ])('%s → %s', (filename, expected) => {
    expect(detectLanguage(filename).name).toBe(expected)
  })

  it('throws for unsupported extensions', () => {
    expect(() => detectLanguage('file.rb')).toThrow('Cannot detect language for: file.rb')
  })
})
