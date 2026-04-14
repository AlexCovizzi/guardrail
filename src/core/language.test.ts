import { describe, expect, it } from 'vitest'
import { detectLanguage } from './language.js'

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
    const language = detectLanguage(filename)
    expect(language?.name).toBe(expected)
  })

  it('returns null for unsupported extensions', () => {
    expect(detectLanguage('file.rb')).toBeNull()
  })
})
