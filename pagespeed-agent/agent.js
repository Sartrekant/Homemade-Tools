#!/usr/bin/env node
import 'dotenv/config';
import chalk from 'chalk';
import {
  runAnalysisWithRetry,
  extractScores,
  extractFailedAudits,
  extractLCPResource,
  extractThirdPartyOrigins,
} from './lib/psi.js';
import { runLocalAudit, isLocalServerReachable } from './lib/lighthouse.js';
import { revertChanges, commitFix, hasUncommittedChanges } from './lib/git.js';
import {
  prioritize,
  getFixable,
  getManual,
  applyFix,
  getNote,
} from './lib/dispatcher.js';
import { printServerInstructions } from './lib/fixes/server.js';
import {
  printBanner,
  printScores,
  printFixAttempt,
  printFixResult,
  printSkipped,
  printFinalReport,
  printIteration,
  printPSICall,
  printPSICallDone,
} from './lib/report.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const TARGET_URL = process.env.TARGET_URL;
const SITE_PATH  = process.env.SITE_PATH;
const LOCAL_URL  = process.env.LOCAL_URL;
const PSI_API_KEY = process.env.PSI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const STRATEGY   = process.env.STRATEGY || 'both';
const MAX_ITER   = parseInt(process.env.MAX_ITERATIONS || '30');
const PSI_RUNS   = Math.min(5, Math.max(1, parseInt(process.env.PSI_RUNS || '3')));
const DRY_RUN    = process.env.DRY_RUN === 'true';
const FIX_CATS   = (process.env.FIX_CATEGORIES || 'all').split(',').map(s => s.trim());

// ─── Validation ───────────────────────────────────────────────────────────────

function validateConfig() {
  const missing = [];
  if (!TARGET_URL)  missing.push('TARGET_URL');
  if (!SITE_PATH)   missing.push('SITE_PATH');
  if (!PSI_API_KEY) missing.push('PSI_API_KEY');
  if (missing.length > 0) {
    console.error(chalk.red(`\n✗ Missing required environment variables: ${missing.join(', ')}`));
    console.error(chalk.dim('  Copy .env.example to .env and fill in the values.\n'));
    process.exit(1);
  }
}

// ─── Score helpers ────────────────────────────────────────────────────────────

function allPerfect(scores) {
  return Object.values(scores).every(s => s === 100);
}

function anyImproved(before, after) {
  return Object.keys(before).some(k => after[k] > before[k]);
}

function anyRegressed(before, after, threshold = 3) {
  return Object.keys(before).some(k => after[k] < before[k] - threshold);
}

// ─── PSI wrapper with console output ─────────────────────────────────────────

async function getPSIScores(strategy) {
  printPSICall(strategy, 1, PSI_RUNS);
  const { result, scores } = await runAnalysisWithRetry(TARGET_URL, strategy, PSI_API_KEY, PSI_RUNS);
  printPSICallDone(scores.performance);
  return { result, scores };
}

// ─── Main agent loop ──────────────────────────────────────────────────────────

async function main() {
  printBanner();
  validateConfig();

  if (DRY_RUN) console.log(chalk.yellow('  DRY RUN mode — no files will be changed\n'));

  console.log(chalk.bold(`  Target: ${TARGET_URL}`));
  console.log(chalk.bold(`  Files:  ${SITE_PATH}`));
  if (LOCAL_URL) console.log(chalk.bold(`  Local:  ${LOCAL_URL}`));
  console.log();

  // ── Baseline audit ─────────────────────────────────────────────────────────
  console.log(chalk.bold('Step 1: Baseline audit'));

  let mobileResult, mobileScores, desktopResult, desktopScores;

  try {
    ({ result: mobileResult, scores: mobileScores } = await getPSIScores('mobile'));
  } catch (err) {
    console.error(chalk.red(`\n✗ PSI API call failed: ${err.message}`));
    console.error(chalk.dim('  Check your PSI_API_KEY and TARGET_URL.\n'));
    process.exit(1);
  }

  if (STRATEGY === 'both' || STRATEGY === 'desktop') {
    ({ result: desktopResult, scores: desktopScores } = await getPSIScores('desktop'));
  }

  printScores('Mobile Baseline', mobileScores);
  if (desktopScores) printScores('Desktop Baseline', desktopScores);

  const baselineScores = mobileScores;

  if (allPerfect(mobileScores) && (!desktopScores || allPerfect(desktopScores))) {
    console.log(chalk.bold.green('\n  Already 100/100 on all categories! Nothing to do.\n'));
    process.exit(0);
  }

  // ── Extract context from LHR ───────────────────────────────────────────────
  const lcpResource = extractLCPResource(mobileResult);
  const thirdPartyOrigins = extractThirdPartyOrigins(mobileResult);

  const agentContext = {
    sitePath: SITE_PATH,
    targetUrl: TARGET_URL,
    localUrl: LOCAL_URL,
    lcpSrc: lcpResource.src,
    thirdPartyOrigins,
    anthropic: ANTHROPIC_API_KEY ? { apiKey: ANTHROPIC_API_KEY } : null,
  };

  // ── Determine which local testing is available ─────────────────────────────
  const useLocalLighthouse = LOCAL_URL && isLocalServerReachable(LOCAL_URL);
  if (LOCAL_URL && !useLocalLighthouse) {
    console.log(chalk.yellow(`\n  ⚠ Local server at ${LOCAL_URL} not reachable — skipping local Lighthouse checks`));
    console.log(chalk.dim('    Start your dev server first for faster feedback loops\n'));
  } else if (useLocalLighthouse) {
    console.log(chalk.green(`\n  ✓ Local server reachable at ${LOCAL_URL} — using for fast feedback\n`));
  }

  // ── Fix loop ───────────────────────────────────────────────────────────────
  console.log(chalk.bold('Step 2: Fix loop'));

  let currentResult = mobileResult;
  let currentScores = { ...mobileScores };
  let iteration = 0;
  const fixesApplied = [];
  const fixesFailed = [];

  while (!allPerfect(currentScores) && iteration < MAX_ITER) {
    printIteration(iteration + 1, MAX_ITER);

    const failedAudits = extractFailedAudits(currentResult);
    const filtered = FIX_CATS[0] === 'all'
      ? failedAudits
      : failedAudits.filter(a => FIX_CATS.includes(a.category));

    const prioritized = prioritize(filtered);
    const fixable = getFixable(prioritized);
    const manual = getManual(prioritized);

    if (fixable.length === 0) {
      console.log(chalk.yellow('\n  No more automatically fixable audits remain.'));
      break;
    }

    const audit = fixable[0];
    printFixAttempt(audit.id, audit.title);

    if (DRY_RUN) {
      console.log(chalk.dim(`   [dry-run] Would apply fix for: ${audit.id}`));
      fixesApplied.push({ auditId: audit.id, details: 'dry-run' });
      // Remove from fixable so we don't loop forever
      fixable.shift();
      iteration++;
      continue;
    }

    // Apply the fix
    let fixResult;
    try {
      fixResult = await applyFix(audit, agentContext);
    } catch (err) {
      fixResult = { applied: false, details: err.message };
    }

    if (!fixResult.applied) {
      printFixResult(false, fixResult.details);
      fixesFailed.push({ auditId: audit.id, reason: fixResult.details });
      iteration++;
      continue;
    }

    // ── Verify the fix ───────────────────────────────────────────────────────
    let verifyScores = null;

    if (useLocalLighthouse) {
      console.log(chalk.dim('   Running local Lighthouse for quick verification...'));
      const local = await runLocalAudit(LOCAL_URL);
      if (local) verifyScores = local;
    }

    // Detect regression
    if (verifyScores && anyRegressed(currentScores, verifyScores)) {
      console.log(chalk.red('   Regression detected — reverting'));
      revertChanges(SITE_PATH);
      printFixResult(false, 'Score regressed — changes rolled back', currentScores, verifyScores);
      fixesFailed.push({ auditId: audit.id, reason: 'Score regression during local check' });
      iteration++;
      continue;
    }

    // Commit the fix
    commitFix(SITE_PATH, audit.id, audit.title);
    const details = fixResult.details || audit.id;
    fixesApplied.push({ auditId: audit.id, details });
    printFixResult(true, details, currentScores, verifyScores || currentScores);

    // Re-audit via PSI every 5 successful fixes, or after a high-complexity fix
    const shouldRePSI = fixesApplied.length % 5 === 0;
    if (shouldRePSI) {
      console.log(chalk.dim('\n   Re-auditing via PSI to refresh baseline...'));
      try {
        const refreshed = await getPSIScores('mobile');
        currentResult = refreshed.result;
        currentScores = refreshed.scores;
        printScores('Updated Scores', currentScores);
      } catch {
        console.log(chalk.dim('   PSI re-audit failed — continuing with stale data'));
      }
    }

    iteration++;
  }

  // ── Manual items report ────────────────────────────────────────────────────
  if (iteration === MAX_ITER) {
    console.log(chalk.yellow(`\n  Reached max iterations (${MAX_ITER}). Stopping.`));
  }

  const remainingFailed = extractFailedAudits(currentResult);
  const manualItems = getManual(remainingFailed).map(a => ({
    auditId: a.id,
    reason: getNote(a.id) || 'Requires manual intervention',
  }));

  // ── Final PSI verification ─────────────────────────────────────────────────
  console.log(chalk.bold('\nStep 3: Final verification via PSI'));

  let finalMobile = currentScores;
  let finalDesktop = desktopScores;

  if (fixesApplied.length > 0 && !DRY_RUN) {
    console.log(chalk.dim('  Waiting 10s for any CDN propagation...'));
    await sleep(10_000);

    try {
      const final = await getPSIScores('mobile');
      finalMobile = final.scores;
      printScores('Final Mobile', finalMobile);
    } catch (err) {
      console.log(chalk.yellow(`  Final PSI call failed: ${err.message}`));
    }

    if (STRATEGY === 'both' || STRATEGY === 'desktop') {
      try {
        const finalD = await getPSIScores('desktop');
        finalDesktop = finalD.scores;
        printScores('Final Desktop', finalDesktop);
      } catch {}
    }
  }

  // ── Server config instructions ─────────────────────────────────────────────
  const needsServerConfig = remainingFailed.some(a =>
    ['uses-text-compression', 'cache-insight', 'server-response-time', 'csp-xss', 'has-hsts'].includes(a.id)
  );
  if (needsServerConfig) {
    printServerInstructions(TARGET_URL);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  printFinalReport(
    TARGET_URL,
    baselineScores,
    finalMobile,
    fixesApplied,
    [...fixesFailed, ...manualItems],
  );
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  console.error(chalk.red(`\n✗ Fatal error: ${err.message}`));
  console.error(err.stack);
  process.exit(1);
});
