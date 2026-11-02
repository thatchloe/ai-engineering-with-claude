import type { ReviewReport } from '../src/types/report-types.js';
import type { CodeQualityResult, TestCoverageResult, RefactoringSuggestion } from '../src/types/analysis-results.js';

export const validCodeQuality: CodeQualityResult = {
  file: 'src/premium.ts',
  issues: [
    {
      line: 42,
      severity: 'critical',
      category: 'security',
      description: 'Price is trusted from the request body',
      suggestion: 'Look the price up server-side by plan id'
    },
    {
      line: 88,
      severity: 'medium',
      category: 'maintainability',
      description: 'applyDiscount is 70 lines long',
      suggestion: 'Extract calculateTier() and formatReceipt()'
    }
  ],
  overallScore: 55,
  summary: 'One critical security issue and some long functions.'
};

export const validTestCoverage: TestCoverageResult = {
  file: 'src/premium.ts',
  hasTests: false,
  testFiles: [],
  untestedPaths: [
    {
      type: 'function',
      location: 'calculatePrice (lines 10-40)',
      priority: 'critical',
      reasoning: 'Handles money',
      suggestedTest: "it('charges 9.99 for monthly premium', () => expect(calculatePrice('monthly')).toBe(999))"
    },
    {
      type: 'branch',
      location: 'if (!user.isPremium) in getFeatures()',
      priority: 'low',
      reasoning: 'Cosmetic branch',
      suggestedTest: "it('returns free features for non-premium users', ...)"
    }
  ],
  coverageEstimate: 0,
  summary: 'No tests exist for this file.'
};

export const validRefactoring: RefactoringSuggestion = {
  file: 'src/premium.ts',
  suggestions: [
    {
      type: 'extract-function',
      location: 'applyDiscount lines 50-120',
      impact: 'high',
      description: 'Split pricing and formatting',
      before: 'function applyDiscount(u) { /* 70 lines */ }',
      after: 'function applyDiscount(u) { return formatReceipt(calculateTier(u)); }',
      benefits: 'Testable pieces, less duplication'
    }
  ],
  summary: 'Mostly fine, one long function.'
};

export function makeReport(overrides: Partial<ReviewReport> = {}): ReviewReport {
  return {
    pullRequest: { owner: 'udacity', repo: 'cd14715-simple-todo-app', number: 3 },
    fileReviews: [
      {
        file: 'src/premium.ts',
        codeQuality: validCodeQuality,
        testCoverage: validTestCoverage,
        refactorings: validRefactoring
      }
    ],
    summary: {
      totalFiles: 1,
      overallScore: 55,
      criticalIssues: 1,
      highPriorityTests: 1,
      refactoringOpportunities: 1
    },
    recommendations: [
      {
        priority: 'critical',
        category: 'security',
        description: 'Never trust prices from the client',
        files: ['src/premium.ts']
      }
    ],
    metadata: {
      analyzedAt: '2026-11-02T20:00:00.000Z',
      duration: 1234,
      agentVersions: { orchestrator: '1.0.0' }
    },
    ...overrides
  };
}
