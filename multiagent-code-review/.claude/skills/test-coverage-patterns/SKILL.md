---
name: test-coverage-patterns
description: Guidance for assessing test completeness and writing high-value test cases with meaningful assertions (Jest/Vitest style)
---

# Test Coverage Patterns

Use this when estimating coverage from source alone and when proposing tests.

## Estimating Coverage Statically
1. Inventory units: exported functions, class methods, and each branch (if/else, switch, ternary, early return, catch, loop boundary).
2. Locate tests: `*.test.ts`, `*.spec.ts`, `__tests__/`, `tests/`; match by import path or by function names referenced.
3. Mark a unit "covered" only if a test calls it AND asserts on its outcome. A test that only checks "does not throw" is weak coverage.
4. coverageEstimate = covered units / all units, weighted toward branches (branch coverage is what finds bugs).
5. New files in a PR with no new test file => 0% unless existing tests clearly import them.

## Prioritising Gaps
- critical: payments, pricing, discounts, auth/permissions, deletion, persistence, data migration
- high: core domain logic with branching; input parsing; anything that returns different results per condition
- medium: formatting, helpers used by core logic, validation of non-critical input
- low: trivial getters, constants, logging

## Writing an Actionable Test Suggestion
Each suggestion must contain:
- A descriptive test name: `it('applies 20% discount when subscription is premium')`
- Arrange: concrete input values (not "some data")
- Act: the exact call
- Assert: exact expected value or thrown error class/message

Example (Vitest/Jest):
```ts
it('search is case-insensitive and matches partial titles', () => {
  const list = new TodoList();
  list.add('Buy Milk');
  list.add('Walk dog');
  expect(list.search('milk').map(t => t.title)).toEqual(['Buy Milk']);
});
```

## Edge Cases to Always Consider
- Empty input (empty string/array), whitespace-only, null/undefined
- Boundaries: 0, 1, max, negative numbers, very large numbers
- Duplicates and ordering
- Unicode / case sensitivity
- Errors from dependencies (mock a throwing dependency and assert handling)
- Time-dependent logic: freeze the clock (`vi.useFakeTimers()`, `jest.useFakeTimers()`)

## Assertion Quality
- Prefer `toEqual`/`toBe` on concrete values over `toBeTruthy`
- Assert side effects (calls, stored state), not just return values
- One behaviour per test; name describes behaviour, not implementation

## Output
List untested paths with type, location (function + lines), priority, reasoning, and a concrete suggestedTest.
