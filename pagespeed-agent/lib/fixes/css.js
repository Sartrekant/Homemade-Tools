import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';

// ─── Fix: font-display ────────────────────────────────────────────────────────

export async function fixFontDisplay(sitePath) {
  const cssFiles = await glob('**/*.css', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let count = 0;
  for (const file of cssFiles) {
    let css = await fs.readFile(file, 'utf8');
    if (!/@font-face/i.test(css)) continue;

    let modified = false;
    // Add font-display: optional to @font-face blocks that don't have it
    css = css.replace(/@font-face\s*\{([^}]*)\}/gi, (match, block) => {
      if (/font-display\s*:/i.test(block)) return match;
      modified = true;
      count++;
      return `@font-face {${block}  font-display: optional;\n}`;
    });

    if (modified) await fs.writeFile(file, css, 'utf8');
  }

  return { applied: count > 0, details: `Added font-display: optional to ${count} @font-face rule(s)` };
}

// ─── Fix: unminified-css ──────────────────────────────────────────────────────

export async function minifyCss(sitePath) {
  let postcss, cssnano;
  try {
    postcss = (await import('postcss')).default;
    cssnano = (await import('cssnano')).default;
  } catch {
    return { applied: false, details: 'postcss/cssnano not installed' };
  }

  const cssFiles = await glob('**/*.css', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/*.min.css'],
  });

  let count = 0;
  for (const file of cssFiles) {
    const css = await fs.readFile(file, 'utf8');
    const stat = await fs.stat(file);
    if (stat.size < 1000) continue; // Skip already-tiny files

    try {
      const result = await postcss([cssnano({ preset: 'default' })]).process(css, { from: file });
      if (result.css.length < css.length * 0.95) {
        await fs.writeFile(file, result.css, 'utf8');
        count++;
      }
    } catch {}
  }

  return { applied: count > 0, details: `Minified ${count} CSS file(s)` };
}

// ─── Fix: unused-css-rules (PurgeCSS) ────────────────────────────────────────

export async function purgeUnusedCss(sitePath) {
  let PurgeCSSLib;
  try {
    PurgeCSSLib = (await import('purgecss')).PurgeCSS;
  } catch {
    return { applied: false, details: 'purgecss not installed' };
  }

  const cssFiles = await glob('**/*.css', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  if (cssFiles.length === 0) return { applied: false, details: 'No CSS files found' };

  const contentFiles = await glob('**/*.{html,js,jsx,ts,tsx,vue,svelte}', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  if (contentFiles.length === 0) return { applied: false, details: 'No content files found for PurgeCSS' };

  let count = 0;
  try {
    const results = await new PurgeCSSLib().purge({
      content: contentFiles,
      css: cssFiles,
      safelist: {
        standard: [/^is-/, /^has-/, /^js-/, /^aria-/, /active/, /show/, /hide/, /open/, /closed/],
        deep: [/^data-/],
      },
    });

    for (const result of results) {
      const original = await fs.readFile(result.file, 'utf8');
      if (result.css.length < original.length * 0.95) {
        await fs.writeFile(result.file, result.css, 'utf8');
        count++;
      }
    }
  } catch (err) {
    return { applied: false, details: `PurgeCSS error: ${err.message}` };
  }

  return { applied: count > 0, details: `Purged unused CSS in ${count} file(s)` };
}

// ─── Fix: unminified-javascript ───────────────────────────────────────────────

export async function minifyJs(sitePath) {
  let terser;
  try {
    terser = await import('terser');
  } catch {
    return { applied: false, details: 'terser not installed' };
  }

  const jsFiles = await glob('**/*.js', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**', '**/*.min.js'],
  });

  let count = 0;
  for (const file of jsFiles) {
    const code = await fs.readFile(file, 'utf8');
    const stat = await fs.stat(file);
    if (stat.size < 1000) continue;

    try {
      const result = await terser.minify(code, {
        compress: { drop_console: false },
        mangle: true,
      });
      if (result.code && result.code.length < code.length * 0.95) {
        await fs.writeFile(file, result.code, 'utf8');
        count++;
      }
    } catch {}
  }

  return { applied: count > 0, details: `Minified ${count} JS file(s)` };
}

// ─── Fix: uses-text-compression (pre-compress static assets) ─────────────────

export async function preCompressAssets(sitePath) {
  const { execSync } = await import('child_process');

  // Check if gzip/brotli are available
  let hasGzip = false;
  let hasBrotli = false;
  try { execSync('gzip --version', { stdio: 'pipe' }); hasGzip = true; } catch {}
  try { execSync('brotli --version', { stdio: 'pipe' }); hasBrotli = true; } catch {}

  if (!hasGzip && !hasBrotli) {
    return { applied: false, details: 'Neither gzip nor brotli available on this system' };
  }

  const assets = await glob('**/*.{html,css,js,svg,json}', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let count = 0;
  for (const file of assets) {
    if (hasGzip && !await fs.pathExists(`${file}.gz`)) {
      try { execSync(`gzip -k -9 "${file}"`, { stdio: 'pipe' }); count++; } catch {}
    }
    if (hasBrotli && !await fs.pathExists(`${file}.br`)) {
      try { execSync(`brotli -k -q 11 "${file}"`, { stdio: 'pipe' }); count++; } catch {}
    }
  }

  return {
    applied: count > 0,
    details: `Pre-compressed ${count} asset(s). Configure your server to serve .br/.gz files.`,
  };
}
