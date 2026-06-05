import { execSync } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs';

// Returns null if Lighthouse is unavailable, otherwise runs an audit
export async function runLocalAudit(url) {
  const outFile = path.join(os.tmpdir(), `lhr-${Date.now()}.json`);
  try {
    execSync(
      `npx lighthouse "${url}" --output=json --output-path="${outFile}" ` +
      `--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage" ` +
      `--only-categories=performance,accessibility,best-practices,seo ` +
      `--quiet`,
      { stdio: 'pipe', timeout: 120_000 }
    );

    const raw = fs.readFileSync(outFile, 'utf8');
    fs.unlinkSync(outFile);
    const lhr = JSON.parse(raw);
    return extractLocalScores(lhr);
  } catch {
    if (fs.existsSync(outFile)) fs.unlinkSync(outFile);
    return null;
  }
}

function extractLocalScores(lhr) {
  const cats = lhr.categories || {};
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
    audits: lhr.audits,
  };
}

export function isLocalServerReachable(url) {
  try {
    execSync(`curl -s --max-time 3 -o /dev/null -w "%{http_code}" "${url}"`, {
      stdio: 'pipe',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}
