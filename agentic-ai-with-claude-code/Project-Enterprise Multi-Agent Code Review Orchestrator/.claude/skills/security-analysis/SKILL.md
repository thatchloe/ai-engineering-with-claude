---
name: security-analysis
description: Security-focused code review covering OWASP Top 10, secure coding practices and common vulnerability patterns in application code
---

# Security Analysis

Checklist for reviewing application code for security defects. Report only findings supported by the code.

## Injection (OWASP A03)
- SQL/NoSQL: string-built queries with user data -> use parameterized queries / query builders
- Command injection: `exec`/`spawn` with interpolated input -> use arg arrays, allow-lists
- XSS: writing user input into HTML/`innerHTML`/templates without escaping
- Path traversal: user-controlled file paths without normalization + base-dir check
- Regex injection / ReDoS: user input in `new RegExp`, catastrophic backtracking patterns

## Authentication & Authorization (A01, A07)
- Missing authorization checks before reading/modifying another user's resources (IDOR)
- Trusting client-supplied roles/flags (e.g. `isPremium`, `isAdmin` in request body)
- Weak session handling, tokens in URLs, no expiry
- Password handling: plain text, weak hashing (md5/sha1), no salting -> bcrypt/argon2

## Sensitive Data (A02)
- Hardcoded secrets, API keys, tokens, connection strings in source
- Logging PII, credentials, card numbers; returning stack traces to clients
- Weak crypto: `Math.random` for tokens, ECB mode, custom crypto -> `crypto.randomBytes`, vetted libraries

## Input Validation & Business Logic
- Missing validation of types, ranges, lengths (negative quantities, huge payloads)
- Money/price computed on the client or trusted from the request
- Floating point for currency; rounding errors in billing
- Race conditions in check-then-act sequences (double spend, duplicate subscription)
- Mass assignment: spreading request bodies into models

## Error Handling & Resilience
- Empty catch blocks, errors converted to success responses
- Unbounded loops/allocations driven by input size (DoS)
- Missing rate limiting on expensive or auth endpoints

## Dependencies & Config
- Outdated/vulnerable packages, dangerous `eval`/`Function`
- Debug flags, permissive CORS, disabled TLS verification

## Severity Guide
- critical: remotely exploitable (injection, auth bypass, secrets in code, payment manipulation)
- high: exploitable with some preconditions, or sensitive data exposure
- medium: defense-in-depth gap (missing validation, weak randomness in non-auth context)
- low: hardening suggestion

## Output
For each finding: line number, vulnerability class, how it could be exploited here, and the concrete secure fix (code snippet).
