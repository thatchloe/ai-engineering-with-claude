import { ReviewReport } from '../types/report-types';

/**
 * Report Generator
 * Converts ReviewReport to various output formats (Markdown, HTML, JSON)
 */
export class ReportGenerator {
  /**
   * Generate a Markdown report for PR comments
   */
  generateMarkdownReport(report: ReviewReport): string {
    const { summary, recommendations, fileReviews } = report;

    const formattedRecs = recommendations.slice(0, 5).map((rec, idx) => {
      const emoji = {
        critical: '🚨',
        high: '⚠️',
        medium: '📝',
        low: '💡'
      }[rec.priority];

      return `${idx + 1}. ${emoji} **${rec.category}**: ${rec.description}
   - Files: ${rec.files.join(', ')}`;
    }).join('\n\n');

    const formattedFiles = fileReviews.map(review => {
      const { file, codeQuality, testCoverage, refactorings } = review;

      const issueList = codeQuality.issues.slice(0, 3)
        .map(i => `  - Line ${i.line}: \`${i.severity}\` ${i.description}`)
        .join('\n');

      const testList = testCoverage.untestedPaths.slice(0, 2)
        .map(p => `  - \`${p.location}\` (${p.priority} priority)`)
        .join('\n');

      const refactorList = refactorings.suggestions.slice(0, 2)
        .map(s => `  - **${s.type}**: ${s.description}`)
        .join('\n');

      return `### 📄 \`${file}\`

**Quality Score:** ${codeQuality.overallScore}/100 | **Coverage:** ~${testCoverage.coverageEstimate}%

#### Issues (${codeQuality.issues.length})
${issueList || '  None found'}
${codeQuality.issues.length > 3 ? `\n  *...and ${codeQuality.issues.length - 3} more*` : ''}

#### Test Gaps (${testCoverage.untestedPaths.length})
${testList || '  None found'}
${testCoverage.untestedPaths.length > 2 ? `\n  *...and ${testCoverage.untestedPaths.length - 2} more*` : ''}

#### Refactoring Opportunities (${refactorings.suggestions.length})
${refactorList || '  None found'}
${refactorings.suggestions.length > 2 ? `\n  *...and ${refactorings.suggestions.length - 2} more*` : ''}`;
    }).join('\n\n---\n\n');

    return `# 🔍 Code Review Report

## Summary

| Metric | Value |
|--------|-------|
| **Overall Score** | ${summary.overallScore}/100 |
| **Files Reviewed** | ${summary.totalFiles} |
| **Critical Issues** | ${summary.criticalIssues} |
| **High Priority Tests** | ${summary.highPriorityTests} |
| **Refactoring Opportunities** | ${summary.refactoringOpportunities} |

## 🎯 Top Recommendations

${formattedRecs || 'No recommendations at this time.'}

## 📁 File Details

${formattedFiles}

---

*Generated at ${report.metadata.analyzedAt} • Duration: ${report.metadata.duration}ms*
`;
  }

  /**
   * Generate an HTML report for web display
   */
  generateHTMLReport(report: ReviewReport): string {
    const { summary, recommendations, metadata, fileReviews } = report;
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const fileSections = fileReviews.map(({ file, codeQuality, testCoverage, refactorings }) => {
      const issues = codeQuality.issues.map(i => `
        <li class="issue-${i.severity}">
          <span class="badge">${i.severity.toUpperCase()}</span>
          <span class="cat">${esc(i.category)}</span> &middot; line ${i.line}: ${esc(i.description)}
          <br><small><strong>Fix:</strong> ${esc(i.suggestion)}</small>
        </li>`).join('');
      const tests = testCoverage.untestedPaths.map(p => `
        <li class="issue-${p.priority}">
          <span class="badge">${p.priority.toUpperCase()}</span>
          <strong>${esc(p.type)}</strong> ${esc(p.location)} &mdash; ${esc(p.reasoning)}
          <pre>${esc(p.suggestedTest)}</pre>
        </li>`).join('');
      const refs = refactorings.suggestions.map(r => `
        <li class="issue-${r.impact}">
          <span class="badge">${r.impact.toUpperCase()}</span>
          <strong>${esc(r.type)}</strong> ${esc(r.location)} &mdash; ${esc(r.description)}
          <div class="diff"><div><em>Before</em><pre>${esc(r.before)}</pre></div><div><em>After</em><pre>${esc(r.after)}</pre></div></div>
          <small><strong>Benefits:</strong> ${esc(r.benefits)}</small>
        </li>`).join('');
      return `
  <section class="file">
    <h3>📄 ${esc(file)}</h3>
    <p class="scores">Quality score <strong>${codeQuality.overallScore}/100</strong> &middot; Estimated coverage <strong>${testCoverage.coverageEstimate}%</strong>${testCoverage.testFiles.length ? ` &middot; Tests: ${esc(testCoverage.testFiles.join(', '))}` : ' &middot; No tests found'}</p>
    <p>${esc(codeQuality.summary)}</p>
    <h4>Issues (${codeQuality.issues.length})</h4>
    <ul>${issues || '<li>None found</li>'}</ul>
    <h4>Test gaps (${testCoverage.untestedPaths.length})</h4>
    <p>${esc(testCoverage.summary)}</p>
    <ul>${tests || '<li>None found</li>'}</ul>
    <h4>Refactoring opportunities (${refactorings.suggestions.length})</h4>
    <p>${esc(refactorings.summary)}</p>
    <ul>${refs || '<li>None found</li>'}</ul>
  </section>`;
    }).join('');

    const recList = recommendations.slice(0, 5).map(r => `
      <li class="rec-${r.priority}">
        <span class="priority">[${r.priority.toUpperCase()}]</span>
        <strong>${esc(r.category)}</strong>: ${esc(r.description)}
        <br><small>Files: ${esc(r.files.join(', '))}</small>
      </li>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Review Report</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1000px;
      margin: 0 auto;
      padding: 24px;
      background: #f8f9fa;
      color: #212529;
    }
    h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 12px; }
    .summary {
      background: white;
      padding: 24px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin: 24px 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
    }
    .metric { text-align: center; }
    .metric-value { font-size: 2em; font-weight: bold; color: #3498db; }
    .metric-label { color: #6c757d; font-size: 0.9em; }
    ul { list-style: none; padding: 0; }
    li { padding: 12px; margin: 8px 0; border-radius: 4px; background: white; }
    .rec-critical { border-left: 4px solid #e74c3c; }
    .rec-high { border-left: 4px solid #f39c12; }
    .rec-medium { border-left: 4px solid #3498db; }
    .rec-low { border-left: 4px solid #27ae60; }
    .priority { font-weight: bold; margin-right: 8px; }
    .rec-critical .priority { color: #e74c3c; }
    .rec-high .priority { color: #f39c12; }
    .rec-medium .priority { color: #3498db; }
    .rec-low .priority { color: #27ae60; }
    footer { text-align: center; color: #6c757d; margin-top: 32px; font-size: 0.9em; }
    .file { background: white; padding: 20px 24px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin: 24px 0; }
    .file h3 { margin-top: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .file h4 { margin-bottom: 8px; color: #2c3e50; }
    .scores { color: #6c757d; }
    .badge { font-size: 0.75em; font-weight: bold; padding: 2px 6px; border-radius: 3px; background: #e9ecef; margin-right: 6px; }
    .cat { color: #6c757d; }
    .file li { border-left: 4px solid #ced4da; background: #f8f9fa; }
    .issue-critical { border-left-color: #e74c3c !important; } .issue-critical .badge { background: #e74c3c; color: white; }
    .issue-high { border-left-color: #f39c12 !important; } .issue-high .badge { background: #f39c12; color: white; }
    .issue-medium { border-left-color: #3498db !important; } .issue-medium .badge { background: #3498db; color: white; }
    .issue-low { border-left-color: #27ae60 !important; } .issue-low .badge { background: #27ae60; color: white; }
    .issue-info { border-left-color: #95a5a6 !important; }
    pre { background: #272c34; color: #e6e6e6; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85em; white-space: pre-wrap; }
    .diff { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 0; }
    @media (max-width: 700px) { .diff { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <h1>🔍 Code Review Report</h1>
  
  <div class="summary">
    <div class="metric">
      <div class="metric-value">${summary.overallScore}</div>
      <div class="metric-label">Overall Score</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.totalFiles}</div>
      <div class="metric-label">Files Reviewed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.criticalIssues}</div>
      <div class="metric-label">Critical Issues</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.highPriorityTests}</div>
      <div class="metric-label">Tests Needed</div>
    </div>
    <div class="metric">
      <div class="metric-value">${summary.refactoringOpportunities}</div>
      <div class="metric-label">Refactorings</div>
    </div>
  </div>

  <h2>🎯 Top Recommendations</h2>
  <ul>${recList || '<li>No recommendations at this time.</li>'}</ul>

  <h2>📁 File Details</h2>
  ${fileSections || '<p>No files were reviewed.</p>'}

  <footer>
    Generated at ${metadata.analyzedAt} • Duration: ${metadata.duration}ms
  </footer>
</body>
</html>`;
  }

  /**
   * Generate formatted JSON report
   */
  generateJSONReport(report: ReviewReport): string {
    return JSON.stringify(report, null, 2);
  }
}
