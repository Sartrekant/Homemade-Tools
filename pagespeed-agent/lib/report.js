import chalk from 'chalk';

const SCORE_COLOR = (score) => {
  if (score >= 90) return chalk.green(score);
  if (score >= 50) return chalk.yellow(score);
  return chalk.red(score);
};

const CATEGORY_LABELS = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  bestPractices: 'Best Practices',
  seo: 'SEO',
};

export function printBanner() {
  console.log('\n' + chalk.bold.cyan('╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('    PageSpeed Agent — Autonomous Optimizer    ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════╝') + '\n');
}

export function printScores(label, scores) {
  console.log(chalk.bold(`\n${label}`));
  console.log(chalk.dim('─'.repeat(40)));
  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    const score = scores[key] ?? 0;
    const bar = buildBar(score);
    console.log(`  ${label.padEnd(16)} ${bar} ${SCORE_COLOR(score)}`);
  }
  console.log();
}

export function printFixAttempt(auditId, description) {
  console.log(chalk.bold.blue(`\n⚙  Fixing: ${auditId}`));
  if (description) console.log(chalk.dim(`   ${description}`));
}

export function printFixResult(success, details, scoresBefore, scoresAfter) {
  if (success) {
    console.log(chalk.green('   ✓ Applied'));
    if (scoresAfter) {
      const perfDelta = scoresAfter.performance - scoresBefore.performance;
      if (perfDelta > 0) console.log(chalk.green(`   Performance: +${perfDelta} pts`));
    }
  } else {
    console.log(chalk.red('   ✗ Reverted — score regressed or no improvement'));
  }
  if (details) console.log(chalk.dim(`   ${details}`));
}

export function printSkipped(auditId, reason) {
  console.log(chalk.dim(`\n○  Skipping ${auditId}: ${reason}`));
}

export function printFinalReport(url, baselineScores, finalScores, fixesApplied, fixesFailed) {
  const allPerfect = Object.values(finalScores).every(s => s === 100);

  console.log('\n' + chalk.bold.cyan('╔══════════════════════════════════════════════╗'));
  console.log(chalk.bold.cyan('║') + chalk.bold.white('                  Final Report                ') + chalk.bold.cyan('║'));
  console.log(chalk.bold.cyan('╚══════════════════════════════════════════════╝'));
  console.log(chalk.dim(`\n  URL: ${url}`));

  console.log(chalk.bold('\n  Scores'));
  console.log(chalk.dim('  ' + '─'.repeat(44)));
  console.log(`  ${'Category'.padEnd(18)} ${'Before'.padEnd(10)} ${'After'.padEnd(10)} ${'Delta'}`);
  console.log(chalk.dim('  ' + '─'.repeat(44)));

  for (const [key, label] of Object.entries(CATEGORY_LABELS)) {
    const before = baselineScores[key] ?? 0;
    const after = finalScores[key] ?? 0;
    const delta = after - before;
    const deltaStr = delta > 0 ? chalk.green(`+${delta}`) : delta < 0 ? chalk.red(delta) : chalk.dim('—');
    console.log(`  ${label.padEnd(18)} ${String(before).padEnd(10)} ${SCORE_COLOR(after).padEnd(10)} ${deltaStr}`);
  }

  console.log(chalk.bold('\n  Fixes Applied'));
  console.log(chalk.dim('  ' + '─'.repeat(44)));
  if (fixesApplied.length === 0) {
    console.log(chalk.dim('  None'));
  } else {
    for (const fix of fixesApplied) {
      console.log(chalk.green(`  ✓ ${fix.auditId}`) + chalk.dim(` — ${fix.details}`));
    }
  }

  if (fixesFailed.length > 0) {
    console.log(chalk.bold('\n  Fixes That Need Manual Attention'));
    console.log(chalk.dim('  ' + '─'.repeat(44)));
    for (const fix of fixesFailed) {
      console.log(chalk.yellow(`  ⚠ ${fix.auditId}`) + chalk.dim(` — ${fix.reason}`));
    }
  }

  console.log();
  if (allPerfect) {
    console.log(chalk.bold.green('  🎯 100/100 on all categories! Optimization complete.\n'));
  } else {
    const remaining = Object.entries(finalScores)
      .filter(([, s]) => s < 100)
      .map(([k]) => CATEGORY_LABELS[k]);
    console.log(chalk.yellow(`  Still below 100: ${remaining.join(', ')}`));
    console.log(chalk.dim('  Some issues require manual fixes or architectural changes.\n'));
  }
}

export function printIteration(n, max) {
  console.log(chalk.dim(`\n[Iteration ${n}/${max}]`));
}

export function printPSICall(strategy, run, total) {
  process.stdout.write(chalk.dim(`  Calling PSI API (${strategy}, run ${run}/${total})... `));
}

export function printPSICallDone(score) {
  console.log(chalk.dim(`Performance: ${score}`));
}

function buildBar(score) {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
}
