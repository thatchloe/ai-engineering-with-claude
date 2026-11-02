import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
  ReviewReportSchema,
  CodeQualityResultJSONSchema,
  TestCoverageResultJSONSchema,
  RefactoringSuggestionJSONSchema,
  ReviewReportJSONSchema
} from '../src/types/index.js';
import { makeReport, validCodeQuality, validTestCoverage, validRefactoring } from './fixtures.js';

describe('Zod schemas - valid data', () => {
  it('accepts a valid CodeQualityResult', () => {
    expect(() => CodeQualityResultSchema.parse(validCodeQuality)).not.toThrow();
    expect(CodeQualityResultSchema.parse(validCodeQuality)).toEqual(validCodeQuality);
  });

  it('accepts a valid TestCoverageResult', () => {
    expect(() => TestCoverageResultSchema.parse(validTestCoverage)).not.toThrow();
  });

  it('accepts a valid RefactoringSuggestion', () => {
    expect(() => RefactoringSuggestionSchema.parse(validRefactoring)).not.toThrow();
  });

  it('accepts a complete ReviewReport', () => {
    const report = makeReport();
    expect(ReviewReportSchema.safeParse(report).success).toBe(true);
  });
});

describe('Zod schemas - invalid data', () => {
  it('rejects an invalid severity enum value', () => {
    const bad = {
      ...validCodeQuality,
      issues: [{ ...validCodeQuality.issues[0], severity: 'blocker' }]
    };
    expect(() => CodeQualityResultSchema.parse(bad)).toThrow(ZodError);
  });

  it('rejects an invalid category enum value', () => {
    const bad = {
      ...validCodeQuality,
      issues: [{ ...validCodeQuality.issues[0], category: 'cosmetic' }]
    };
    expect(CodeQualityResultSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects wrong types (line as string, score as string)', () => {
    const bad = {
      ...validCodeQuality,
      overallScore: '90',
      issues: [{ ...validCodeQuality.issues[0], line: '42' }]
    };
    const result = CodeQualityResultSchema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map(i => i.path.join('.'));
      expect(paths).toContain('overallScore');
      expect(paths).toContain('issues.0.line');
    }
  });

  it('rejects missing required fields', () => {
    const { summary: _summary, ...withoutSummary } = validTestCoverage;
    expect(() => TestCoverageResultSchema.parse(withoutSummary)).toThrow(ZodError);

    const { suggestions: _s, ...withoutSuggestions } = validRefactoring;
    expect(RefactoringSuggestionSchema.safeParse(withoutSuggestions).success).toBe(false);
  });

  it('rejects out-of-range scores', () => {
    expect(CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: 101 }).success).toBe(false);
    expect(CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: -1 }).success).toBe(false);
    expect(TestCoverageResultSchema.safeParse({ ...validTestCoverage, coverageEstimate: 150 }).success).toBe(false);
  });

  it('rejects a ReviewReport with an invalid nested result', () => {
    const report = makeReport();
    const bad = {
      ...report,
      fileReviews: [
        { ...report.fileReviews[0], testCoverage: { ...validTestCoverage, hasTests: 'no' } }
      ]
    };
    expect(ReviewReportSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a ReviewReport with an invalid recommendation priority', () => {
    const bad = makeReport({
      recommendations: [{ priority: 'urgent' as never, category: 'x', description: 'y', files: [] }]
    });
    expect(ReviewReportSchema.safeParse(bad).success).toBe(false);
  });
});

describe('Zod schemas - edge cases', () => {
  it('accepts empty arrays for issues, untested paths and suggestions', () => {
    expect(CodeQualityResultSchema.safeParse({ ...validCodeQuality, issues: [] }).success).toBe(true);
    expect(
      TestCoverageResultSchema.safeParse({ ...validTestCoverage, untestedPaths: [], testFiles: [] }).success
    ).toBe(true);
    expect(RefactoringSuggestionSchema.safeParse({ ...validRefactoring, suggestions: [] }).success).toBe(true);
  });

  it('accepts boundary scores 0 and 100', () => {
    expect(CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: 0 }).success).toBe(true);
    expect(CodeQualityResultSchema.safeParse({ ...validCodeQuality, overallScore: 100 }).success).toBe(true);
    expect(TestCoverageResultSchema.safeParse({ ...validTestCoverage, coverageEstimate: 0 }).success).toBe(true);
    expect(TestCoverageResultSchema.safeParse({ ...validTestCoverage, coverageEstimate: 100 }).success).toBe(true);
  });

  it('accepts a ReviewReport with no file reviews and no recommendations', () => {
    const empty = makeReport({
      fileReviews: [],
      recommendations: [],
      summary: { totalFiles: 0, overallScore: 0, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 }
    });
    expect(ReviewReportSchema.safeParse(empty).success).toBe(true);
  });

  it('accepts every allowed enum value', () => {
    for (const severity of ['critical', 'high', 'medium', 'low', 'info'] as const) {
      for (const category of ['security', 'performance', 'maintainability', 'style', 'bug-risk', 'best-practice'] as const) {
        const r = CodeQualityResultSchema.safeParse({
          ...validCodeQuality,
          issues: [{ line: 1, severity, category, description: 'd', suggestion: 's' }]
        });
        expect(r.success).toBe(true);
      }
    }
    for (const type of ['extract-function', 'rename', 'modernize', 'simplify', 'pattern-improvement'] as const) {
      for (const impact of ['low', 'medium', 'high'] as const) {
        const r = RefactoringSuggestionSchema.safeParse({
          ...validRefactoring,
          suggestions: [{ ...validRefactoring.suggestions[0], type, impact }]
        });
        expect(r.success).toBe(true);
      }
    }
  });

  it('strips unknown keys rather than failing (default Zod object behaviour)', () => {
    const parsed = CodeQualityResultSchema.parse({ ...validCodeQuality, extra: 'ignored' });
    expect((parsed as Record<string, unknown>).extra).toBeUndefined();
  });
});

describe('JSON Schema export for SDK structured outputs', () => {
  it('produces an object schema with required properties for each result type', () => {
    for (const schema of [CodeQualityResultJSONSchema, TestCoverageResultJSONSchema, RefactoringSuggestionJSONSchema]) {
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeTypeOf('object');
      expect(Array.isArray(schema.required)).toBe(true);
    }
  });

  it('marks the top-level ReviewReport fields as required', () => {
    expect(ReviewReportJSONSchema.type).toBe('object');
    expect(ReviewReportJSONSchema.required).toEqual(
      expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
    );
  });

  it('inlines nested schemas ($refStrategy root) so the SDK gets a self-contained schema', () => {
    const json = JSON.stringify(ReviewReportJSONSchema);
    expect(json).not.toMatch(/"\$ref":"#\/definitions/);
    const props = ReviewReportJSONSchema.properties as Record<string, { type?: string; items?: { properties?: Record<string, unknown> } }>;
    expect(props.fileReviews?.type).toBe('array');
    expect(props.fileReviews?.items?.properties).toHaveProperty('codeQuality');
    expect(props.fileReviews?.items?.properties).toHaveProperty('testCoverage');
    expect(props.fileReviews?.items?.properties).toHaveProperty('refactorings');
  });

  it('encodes enum constraints and numeric bounds', () => {
    const props = CodeQualityResultJSONSchema.properties as Record<string, Record<string, unknown>>;
    const issueProps = (props.issues?.items as { properties: Record<string, Record<string, unknown>> }).properties;
    expect(issueProps.severity?.enum).toEqual(['critical', 'high', 'medium', 'low', 'info']);
    expect(props.overallScore?.minimum).toBe(0);
    expect(props.overallScore?.maximum).toBe(100);
  });

  it('is serializable to JSON without loss', () => {
    const roundTrip = JSON.parse(JSON.stringify(ReviewReportJSONSchema));
    expect(roundTrip).toEqual(ReviewReportJSONSchema);
  });
});
