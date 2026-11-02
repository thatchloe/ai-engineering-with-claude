/**
 * Verify the submission reports in reports/ for the three required PRs.
 *
 * Checks, for each PR: all three formats exist, the JSON validates against
 * ReviewReportSchema, findings are populated (file paths, line numbers,
 * severities, test suggestions, refactoring code examples), summary numbers
 * match the findings, and the MD/HTML files are non-trivial.
 *
 * Usage: npm run verify:reports
 */
import fs from 'fs';
import path from 'path';
import { ReviewReportSchema } from '../src/types/report-types.js';

const OWNER = 'udacity';
const REPO = 'cd14715-simple-todo-app';
const PRS = [1, 2, 3];
const dir = path.resolve(process.cwd(), 'reports');

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  ❌ ${msg}`); };
const ok = (msg: string) => console.log(`  ✅ ${msg}`);

for (const pr of PRS) {
  const base = path.join(dir, `${OWNER}_${REPO}_${pr}`);
  console.log(`\nPR #${pr}`);

  for (const ext of ['json', 'md', 'html']) {
    const p = `${base}.${ext}`;
    if (!fs.existsSync(p)) { fail(`${path.basename(p)} missing`); continue; }
    const size = fs.statSync(p).size;
    if (size < 500) fail(`${path.basename(p)} is suspiciously small (${size} bytes)`);
    else ok(`${path.basename(p)} (${size} bytes)`);
    const text = fs.readFileSync(p, 'utf8');
    // Look for rendering failures (a value that was undefined/NaN when the report was built),
    // not the word "undefined" inside prose such as "null/undefined input".
    if (ext !== 'json' && /(\bundefined(\/100|%|ms)\b|Line undefined|>\s*undefined\s*<|\*\*\s*undefined\s*\*\*|\bNaN\b|\[object Object\])/.test(text)) {
      fail(`${path.basename(p)} contains an unrendered undefined/NaN/[object Object] value`);
    }
  }

  const jsonPath = `${base}.json`;
  if (!fs.existsSync(jsonPath)) continue;
  const parsed = ReviewReportSchema.safeParse(JSON.parse(fs.readFileSync(jsonPath, 'utf8')));
  if (!parsed.success) { fail(`JSON does not match ReviewReportSchema: ${parsed.error.issues[0]?.path.join('.')} ${parsed.error.issues[0]?.message}`); continue; }
  ok('JSON validates against ReviewReportSchema');
  const r = parsed.data;

  // No empty strings anywhere in the findings
  const emptyStrings: string[] = [];
  const walk = (v: unknown, trail: string) => {
    if (typeof v === 'string') { if (!v.trim()) emptyStrings.push(trail); return; }
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${trail}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${trail}.${k}`);
  };
  walk(r, 'report');
  if (emptyStrings.length) fail(`empty string values at ${emptyStrings.slice(0, 3).join(', ')}`);
  // Structural check for values that were undefined/NaN when serialized
  const badValues: string[] = [];
  const scan = (v: unknown, trail: string) => {
    if (v === null || v === undefined) badValues.push(trail);
    else if (typeof v === 'number' && !Number.isFinite(v)) badValues.push(trail);
    else if (typeof v === 'string' && /^(undefined|NaN|\[object Object\])$/.test(v.trim())) badValues.push(trail);
    else if (Array.isArray(v)) v.forEach((x, i) => scan(x, `${trail}[${i}]`));
    else if (typeof v === 'object') for (const [k, x] of Object.entries(v as object)) scan(x, `${trail}.${k}`);
  };
  scan(r, 'report');
  if (badValues.length) fail(`null/undefined/NaN values at ${badValues.slice(0, 3).join(', ')}`);
  else ok('no undefined, null, NaN or empty values in the JSON');

  if (r.pullRequest.owner !== OWNER || r.pullRequest.repo !== REPO || r.pullRequest.number !== pr) fail('pullRequest metadata mismatch');
  if (r.fileReviews.length === 0) fail('no fileReviews');

  const issues = r.fileReviews.flatMap(f => f.codeQuality.issues);
  const paths = r.fileReviews.flatMap(f => f.testCoverage.untestedPaths);
  const refs = r.fileReviews.flatMap(f => f.refactorings.suggestions);
  console.log(`  files=${r.fileReviews.length} issues=${issues.length} untestedPaths=${paths.length} refactorings=${refs.length} score=${r.summary.overallScore}`);

  for (const f of r.fileReviews) {
    if (!f.file.includes('/') && !f.file.includes('.')) fail(`file review has an odd path: ${f.file}`);
    if (!f.codeQuality.summary || !f.testCoverage.summary || !f.refactorings.summary) fail(`${f.file}: empty summary`);
  }
  if (issues.some(i => !Number.isInteger(i.line) || i.line <= 0)) fail('issue without a valid line number');
  if (issues.length === 0) console.log('  ⚠️  no code quality issues reported (acceptable only for genuinely clean code)');
  if (paths.length === 0) fail('no test coverage suggestions');
  if (paths.some(p => p.suggestedTest.length < 40)) fail('a suggestedTest is too short to be actionable');
  if (refs.length === 0) console.log('  ⚠️  no refactoring suggestions');
  if (refs.some(s => !s.before.trim() || !s.after.trim())) fail('a refactoring suggestion lacks before/after code');
  if (r.recommendations.length === 0) fail('no recommendations');

  const expected = {
    totalFiles: r.fileReviews.length,
    criticalIssues: issues.filter(i => i.severity === 'critical').length,
    highPriorityTests: paths.filter(p => p.priority === 'critical' || p.priority === 'high').length,
    refactoringOpportunities: refs.length
  };
  for (const [k, v] of Object.entries(expected)) {
    if ((r.summary as Record<string, number>)[k] !== v) fail(`summary.${k}=${(r.summary as Record<string, number>)[k]} but findings imply ${v}`);
  }
  const avg = Math.round(r.fileReviews.reduce((a, f) => a + f.codeQuality.overallScore, 0) / Math.max(1, r.fileReviews.length));
  if (r.summary.overallScore !== avg) fail(`summary.overallScore=${r.summary.overallScore} but average of file scores is ${avg}`);
  if (r.metadata.duration <= 0 || Number.isNaN(Date.parse(r.metadata.analyzedAt))) fail('metadata not populated');
}

console.log(failures === 0 ? '\n✅ All report checks passed' : `\n❌ ${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
