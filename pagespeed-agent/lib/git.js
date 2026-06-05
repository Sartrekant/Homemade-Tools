import { execSync } from 'child_process';

export function isClean(sitePath) {
  try {
    const result = execSync('git status --porcelain', { cwd: sitePath, encoding: 'utf8' });
    return result.trim() === '';
  } catch {
    return true;
  }
}

export function commitFix(sitePath, auditId, description) {
  try {
    execSync('git add -A', { cwd: sitePath, stdio: 'pipe' });
    const msg = `perf(${auditId}): ${description}`;
    execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: sitePath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function revertChanges(sitePath) {
  try {
    execSync('git restore .', { cwd: sitePath, stdio: 'pipe' });
    execSync('git clean -fd --exclude=node_modules --exclude=.env', { cwd: sitePath, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function currentCommit(sitePath) {
  try {
    return execSync('git rev-parse HEAD', { cwd: sitePath, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function hasUncommittedChanges(sitePath) {
  try {
    const result = execSync('git status --porcelain', { cwd: sitePath, encoding: 'utf8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}
