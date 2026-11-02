---
name: typescript-patterns
description: Analyzes TypeScript code for type-safety problems, advanced typing patterns and common TS pitfalls
---

# TypeScript Patterns Analyzer

Expert guidance for reviewing TypeScript code. Apply these checks to .ts/.tsx files.

## Type Safety
- Flag `any` (explicit or implicit) - prefer `unknown` + narrowing, generics, or precise types
- Non-null assertions (`!`) hide real null bugs; prefer guards or optional chaining
- `as` casts that widen/narrow unsafely (e.g. `as unknown as T`) are a smell
- Return types on exported functions should be explicit
- Prefer `readonly` arrays/properties for data that must not be mutated
- Enable-strict-mode assumptions: `strictNullChecks`, `noUncheckedIndexedAccess` (index access may be undefined)

## Modeling Data
- Use discriminated unions (`{ kind: 'a' } | { kind: 'b' }`) instead of optional fields that only make sense together
- Prefer string literal unions or `as const` objects over `enum` for simple sets
- Model money as integers (cents) or a decimal library, never `number` with floating arithmetic
- Use `Record<K, V>` / `Map` deliberately; avoid objects as maps when keys are user input (prototype pollution)
- Make illegal states unrepresentable: required fields instead of runtime checks for `undefined`

## Functions & Classes
- Prefer small pure functions; keep side effects (I/O, Date.now, Math.random) at the edges for testability
- Use parameter objects for functions with more than 3 parameters
- Avoid classes that are only bags of static methods - use modules
- Private state: `#field` or `private`, not naming conventions

## Async & Errors
- Every `Promise` must be awaited or returned; flag floating promises
- `async` functions should not mix callbacks
- Catch blocks: `catch (e: unknown)` and narrow; never swallow errors silently
- Throw `Error` subclasses with context, not strings

## Common Pitfalls
- `==` instead of `===`
- `parseInt` without radix; `Number(x)` on untrusted input without `Number.isFinite`
- Array `sort()` without comparator on numbers
- Mutating function arguments / shared module state
- Date handling with local time when UTC is intended
- Regex built from user input without escaping

## Severity Mapping
- critical: type hole that lets invalid data reach persistence/payments/auth
- high: likely runtime error (unchecked undefined, unhandled rejection)
- medium: `any`, unsafe casts, missing return types on public API
- low: style and idiom improvements

## Output
For each issue: line number, category, why it is a problem in this code, and a concrete fix with a snippet.
