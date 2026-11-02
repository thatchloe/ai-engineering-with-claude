# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | 0/100 |
| **Files Reviewed** | 1 |
| **Critical Issues** | 3 |
| **High Priority Tests** | 8 |
| **Refactoring Opportunities** | 7 |

## 🎯 Top Recommendations

1. 🚨 **security**: Fix SQL injection vulnerabilities in searchTodos, searchTodosByStatus, and getTodosByUser by replacing string concatenation with parameterized queries.
   - Files: src/todo.ts

2. 🚨 **testing**: Add security tests that demonstrate the three SQL injection vulnerabilities before fixing them to prevent regression.
   - Files: src/todo.ts

3. ⚠️ **testing**: Add unit tests for all database operations (createTodo, getAllTodos, getTodoById, updateTodoStatus, deleteTodo) to verify parameterized query usage.
   - Files: src/todo.ts

4. ⚠️ **security**: Replace insecure Math.random() ID generation with crypto.randomUUID() to prevent ID prediction and collision risks.
   - Files: src/todo.ts

5. 📝 **refactoring**: Extract a Repository pattern to centralize database access, making security fixes systematic and enabling easier testing.
   - Files: src/todo.ts

## 📁 File Details

### 📄 `src/todo.ts`

**Quality Score:** 0/100 | **Coverage:** ~15%

#### Issues (11)
  - Line 121: `critical` SQL injection vulnerability via direct string interpolation of user input in LIKE clause. An attacker can inject malicious SQL by providing input like: `%' OR '1'='1` or `'; DROP TABLE todos; --` to extract data, modify records, or execute arbitrary SQL.
  - Line 132: `critical` SQL injection vulnerability via direct string concatenation of unvalidated user input. An attacker can provide input like `1 OR 1=1` or `1; DROP TABLE todos; --` to bypass the WHERE clause or execute arbitrary SQL commands.
  - Line 143: `critical` SQL injection vulnerability via template literal with unsanitized userId. An attacker can inject SQL by providing input like: `' OR '1'='1` or `'; DELETE FROM user_todos; --` to access unauthorized data or manipulate the database.

  *...and 8 more*

#### Test Gaps (13)
  - `createTodo (lines 51-74)` (critical priority)
  - `getAllTodos (lines 79-83)` (high priority)

  *...and 11 more*

#### Refactoring Opportunities (7)
  - **extract-function**: Extract a single sanitizeAndValidateTodo function to combine validation and sanitization, reducing duplication and ensuring consistent input processing across all todo creation flows.
  - **pattern-improvement**: Extract a Repository pattern to separate SQL query construction from business logic, centralizing parameterized query handling and making functions easier to test without a real database.

  *...and 5 more*

---

*Generated at 2026-11-02T20:25:17.586Z • Duration: 235193ms*
