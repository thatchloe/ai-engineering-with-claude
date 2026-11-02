---
name: refactoring-patterns
description: Catalogue of refactorings (extract, simplify, modernize, design patterns) with when-to-apply rules and before/after templates
---

# Refactoring Patterns

Use this to pick high-value structural improvements and present them as before/after examples.

## Extract
- Extract Function: a block with a comment explaining it, repeated 2+ times, or a function > 30 lines
- Extract Class/Module: a class with two reasons to change (e.g. pricing + persistence)
- Replace Temp with Query, Introduce Parameter Object (> 3 params)

## Simplify
- Guard clauses / early returns instead of nested if/else
- Decompose Conditional: name complex boolean expressions
- Consolidate duplicate conditional fragments
- Remove dead code, unused params, commented-out code, unreachable branches
- Replace magic numbers/strings with named constants
- Replace boolean flag parameters with two functions or an options object

## Modernize (JS/TS)
- `var` -> `const`/`let`; callbacks/`.then` chains -> `async`/`await`
- Manual loops -> `map`/`filter`/`reduce`/`find`/`some` when it improves clarity
- String concatenation -> template literals
- Nested null checks -> optional chaining `?.` and nullish coalescing `??`
- `any` -> precise types, discriminated unions, generics
- Object/array copies via spread; `Object.freeze` / `readonly` for immutability

## Design Patterns (apply only when the code already strains)
- Strategy / lookup table instead of growing `switch`/`if` chains on a type field
- Factory for object creation with variants
- Dependency Injection for clocks, random, I/O - enables testing
- Repository to separate persistence from domain logic
- Immutable value objects for money, ids, dates

## Rename
- Names should reveal intent: `d` -> `daysSinceLogin`, `process()` -> `applyDiscounts()`
- Booleans read as predicates: `isActive`, `hasAccess`
- Avoid abbreviations and type-encoding (`strName`)

## Impact Rating
- high: removes duplication across several places, shrinks a complex function substantially, or makes untestable code testable
- medium: clearer logic in one function/class
- low: cosmetic readability

## Before/After Template
- before: copy the real lines from the file (5-25 lines)
- after: the refactored code, compilable, same behaviour
- benefits: concrete (fewer branches, testable without DB, removes 3 duplicates)

## Output
3-7 suggestions ranked by impact, each with type, location, before, after and benefits.
