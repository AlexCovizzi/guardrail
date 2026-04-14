# AGENTS.md

## About

Guardrail — a static analysis tool for AI-generated code.
Parses source files with tree-sitter, walks the AST, and runs user-defined rules that enforce bounds like max function lines, max nesting depth, max class methods, etc.
Supports JavaScript, TypeScript, JSX, TSX, Python, Java, and Kotlin.
Usable as a CLI (`guardrail check`) or as a library for Claude Code hooks.

## Commands

```bash
npm run build        # tsc + chmod (must pass before done)
npm test             # vitest run
npx tsc --noEmit     # type check only
```

## Guidelines

- Run `npm run fix`, `npm run check`, `npm run build` and `npm test` before considering work done. Fix any issues.
