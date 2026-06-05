import * as cheerio from 'cheerio';
import { glob } from 'glob';
import fs from 'fs-extra';
import path from 'path';

// ─── File discovery ───────────────────────────────────────────────────────────

export async function findHtmlFiles(sitePath) {
  return glob('**/*.html', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
}

export async function findCssFiles(sitePath) {
  return glob('**/*.css', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
}

// ─── Per-file fix helpers ─────────────────────────────────────────────────────

function loadHtml(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return cheerio.load(raw, { decodeEntities: false });
}

function saveHtml($, filePath) {
  fs.writeFileSync(filePath, $.html(), 'utf8');
}

// ─── Fix: html-has-lang ───────────────────────────────────────────────────────

export async function addLangAttribute(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if (!$('html').attr('lang')) {
      $('html').attr('lang', 'en');
      saveHtml($, file);
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added lang="en" to ${changed} file(s)` };
}

// ─── Fix: doctype ─────────────────────────────────────────────────────────────

export async function ensureDoctype(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    if (!/^\s*<!doctype\s+html/i.test(html)) {
      html = '<!DOCTYPE html>\n' + html;
      fs.writeFileSync(file, html, 'utf8');
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added DOCTYPE to ${changed} file(s)` };
}

// ─── Fix: charset ─────────────────────────────────────────────────────────────

export async function ensureCharset(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if ($('meta[charset]').length === 0 && $('meta[http-equiv="Content-Type"]').length === 0) {
      $('head').prepend('<meta charset="utf-8">');
      saveHtml($, file);
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added charset meta to ${changed} file(s)` };
}

// ─── Fix: document-title ──────────────────────────────────────────────────────

export async function ensureTitle(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if ($('title').length === 0) {
      // Derive title from h1, or filename
      const h1 = $('h1').first().text().trim();
      const base = path.basename(file, '.html');
      const title = h1 || (base === 'index' ? 'Home' : toTitleCase(base));
      $('head').append(`<title>${title}</title>`);
      saveHtml($, file);
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added <title> to ${changed} file(s)` };
}

// ─── Fix: meta-description ────────────────────────────────────────────────────

export async function ensureMetaDescription(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if ($('meta[name="description"]').length === 0) {
      // Extract first paragraph as description
      const first = $('p').first().text().trim().replace(/\s+/g, ' ');
      const desc = first.length > 155 ? first.slice(0, 152) + '...' : first || 'Welcome to our website.';
      $('head').append(`<meta name="description" content="${escapeAttr(desc)}">`);
      saveHtml($, file);
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added meta description to ${changed} file(s)` };
}

// ─── Fix: canonical ───────────────────────────────────────────────────────────

export async function ensureCanonical(sitePath, targetUrl) {
  const files = await findHtmlFiles(sitePath);
  let changed = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if ($('link[rel="canonical"]').length === 0) {
      const base = path.basename(file);
      const isIndex = base === 'index.html';
      const relPath = path.relative(sitePath, file).replace(/\\/g, '/').replace(/index\.html$/, '');
      const canonical = targetUrl.replace(/\/$/, '') + '/' + (isIndex ? '' : relPath);
      $('head').append(`<link rel="canonical" href="${canonical}">`);
      saveHtml($, file);
      changed++;
    }
  }
  return { applied: changed > 0, details: `Added canonical link to ${changed} file(s)` };
}

// ─── Fix: image-alt ───────────────────────────────────────────────────────────

export async function fixImageAlts(sitePath, anthropic) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('img').each((_, el) => {
      if (!$(el).attr('alt') && $(el).attr('alt') !== '') {
        const src = $(el).attr('src') || '';
        const alt = generateAltFromSrc(src);
        $(el).attr('alt', alt);
        modified = true;
        count++;
      }
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added alt text to ${count} image(s)` };
}

// ─── Fix: button-name ─────────────────────────────────────────────────────────

export async function fixButtonNames(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('button').each((_, el) => {
      const $el = $(el);
      const hasText = $el.text().trim().length > 0;
      const hasLabel = $el.attr('aria-label') || $el.attr('title');
      if (!hasText && !hasLabel) {
        const type = $el.attr('type') || 'button';
        $el.attr('aria-label', toTitleCase(type));
        modified = true;
        count++;
      }
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added aria-label to ${count} button(s)` };
}

// ─── Fix: offscreen-images (lazy loading) ─────────────────────────────────────

export async function addLazyLoading(sitePath, lcpSrc) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('img').each((_, el) => {
      const $el = $(el);
      const src = $el.attr('src') || '';
      const isLcp = lcpSrc && src.includes(lcpSrc);
      const hasFetch = $el.attr('fetchpriority') === 'high';
      if (!isLcp && !hasFetch && !$el.attr('loading')) {
        $el.attr('loading', 'lazy');
        modified = true;
        count++;
      }
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added loading="lazy" to ${count} image(s)` };
}

// ─── Fix: unsized-images ──────────────────────────────────────────────────────

export async function addImageDimensions(sitePath) {
  let { default: sharp } = await import('sharp').catch(() => ({ default: null }));
  if (!sharp) return { applied: false, details: 'sharp not installed' };

  const files = await findHtmlFiles(sitePath);
  let count = 0;

  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;

    for (const el of $('img').toArray()) {
      const $el = $(el);
      if ($el.attr('width') && $el.attr('height')) continue;
      const src = $el.attr('src') || '';
      if (!src || src.startsWith('http') || src.startsWith('data:')) continue;

      const imgPath = resolveAsset(sitePath, file, src);
      if (!imgPath || !await fs.pathExists(imgPath)) continue;

      try {
        const meta = await sharp(imgPath).metadata();
        if (meta.width && meta.height) {
          $el.attr('width', meta.width);
          $el.attr('height', meta.height);
          modified = true;
          count++;
        }
      } catch {}
    }

    if (modified) saveHtml($, file);
  }

  return { applied: count > 0, details: `Added dimensions to ${count} image(s)` };
}

// ─── Fix: render-blocking-resources (defer scripts) ───────────────────────────

export async function deferScripts(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('head script[src]').each((_, el) => {
      const $el = $(el);
      if (!$el.attr('defer') && !$el.attr('async') && !$el.attr('type')?.includes('module')) {
        $el.attr('defer', '');
        modified = true;
        count++;
      }
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added defer to ${count} script(s)` };
}

// ─── Fix: uses-rel-preconnect ─────────────────────────────────────────────────

export async function addPreconnect(sitePath, origins) {
  if (!origins || origins.length === 0) return { applied: false, details: 'No third-party origins detected' };
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const existing = $('link[rel="preconnect"]').map((_, el) => $(el).attr('href')).get();
    let added = 0;
    for (const origin of origins.slice(0, 5)) {
      if (!existing.includes(origin)) {
        $('head').prepend(`<link rel="preconnect" href="${origin}" crossorigin>`);
        added++;
      }
    }
    if (added > 0) {
      saveHtml($, file);
      count += added;
    }
  }
  return { applied: count > 0, details: `Added ${count} preconnect hint(s)` };
}

// ─── Fix: lcp-discovery-insight (preload + fetchpriority) ────────────────────

export async function optimizeLCP(sitePath, lcpSrc) {
  if (!lcpSrc) return { applied: false, details: 'LCP resource not identified' };
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const $lcp = $(`img[src*="${lcpSrc}"]`).first();
    if ($lcp.length === 0) continue;

    // Add fetchpriority and remove lazy loading
    $lcp.attr('fetchpriority', 'high');
    $lcp.attr('loading', 'eager');
    $lcp.removeAttr('loading'); // Replace with eager
    $lcp.attr('loading', 'eager');
    $lcp.attr('decoding', 'async');

    // Add preload link at top of head
    const src = $lcp.attr('src');
    const existing = $(`link[rel="preload"][href*="${lcpSrc}"]`);
    if (existing.length === 0) {
      const preload = `<link rel="preload" as="image" href="${src}" fetchpriority="high">`;
      $('head').prepend(preload);
    }

    saveHtml($, file);
    count++;
  }
  return { applied: count > 0, details: `Optimized LCP element in ${count} file(s)` };
}

// ─── Fix: bypass (skip link) ──────────────────────────────────────────────────

export async function addSkipLink(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const firstLink = $('a').first();
    if (firstLink.attr('href') === '#main-content' || firstLink.attr('href') === '#main') continue;

    // Ensure main element has id
    if ($('main').length && !$('main').attr('id')) $('main').attr('id', 'main-content');
    if ($('[role="main"]').length && !$('[role="main"]').attr('id')) $('[role="main"]').attr('id', 'main-content');

    const skip = '<a href="#main-content" class="skip-link" style="position:absolute;left:-9999px;top:0;z-index:9999;padding:.5rem 1rem;background:#000;color:#fff;text-decoration:none">Skip to main content</a>';
    $('body').prepend(skip);
    saveHtml($, file);
    count++;
  }
  return { applied: count > 0, details: `Added skip link to ${count} page(s)` };
}

// ─── Fix: heading-order ───────────────────────────────────────────────────────

export async function fixHeadingOrder(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const headings = $('h1,h2,h3,h4,h5,h6').toArray();
    let last = 0;
    let modified = false;
    for (const el of headings) {
      const level = parseInt(el.tagName[1]);
      if (level > last + 1 && last > 0) {
        // Skipped a level — demote to last+1
        el.tagName = `h${last + 1}`;
        modified = true;
      }
      last = parseInt(el.tagName[1]);
    }
    if (modified) {
      saveHtml($, file);
      count++;
    }
  }
  return { applied: count > 0, details: `Fixed heading order in ${count} file(s)` };
}

// ─── Fix: is-crawlable ────────────────────────────────────────────────────────

export async function fixCrawlability(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const noindex = $('meta[name="robots"][content*="noindex"]');
    if (noindex.length > 0) {
      noindex.remove();
      saveHtml($, file);
      count++;
    }
  }

  // Also check robots.txt
  const robotsPath = path.join(sitePath, 'robots.txt');
  if (await fs.pathExists(robotsPath)) {
    let robots = await fs.readFile(robotsPath, 'utf8');
    if (/Disallow:\s*\/\s*$/m.test(robots)) {
      robots = robots.replace(/Disallow:\s*\/\s*$/m, 'Disallow:');
      await fs.writeFile(robotsPath, robots, 'utf8');
      count++;
    }
  }

  return { applied: count > 0, details: `Removed noindex/crawl blocks from ${count} location(s)` };
}

// ─── Fix: label ───────────────────────────────────────────────────────────────

export async function fixFormLabels(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('input, textarea, select').each((_, el) => {
      const $el = $(el);
      const id = $el.attr('id');
      const type = $el.attr('type') || 'text';
      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;
      if ($el.attr('aria-label') || $el.attr('aria-labelledby')) return;
      if (id && $(`label[for="${id}"]`).length) return;

      // Generate a label from placeholder or name or type
      const text = $el.attr('placeholder') || $el.attr('name') || toTitleCase(type);
      $el.attr('aria-label', text);
      modified = true;
      count++;
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added aria-label to ${count} input(s)` };
}

// ─── Fix: link-name ───────────────────────────────────────────────────────────

export async function fixLinkNames(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  const genericTexts = ['click here', 'read more', 'learn more', 'here', 'more', 'link'];
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('a').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim().toLowerCase();
      const hasLabel = $el.attr('aria-label') || $el.attr('title');
      if (!hasLabel && (genericTexts.includes(text) || $el.children('img').length)) {
        const href = $el.attr('href') || '';
        const label = hrefToLabel(href) || 'Link';
        $el.attr('aria-label', label);
        modified = true;
        count++;
      }
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added aria-label to ${count} link(s)` };
}

// ─── Fix: html lang for iframes ───────────────────────────────────────────────

export async function fixIframeTitles(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    let modified = false;
    $('iframe:not([title])').each((_, el) => {
      const src = $(el).attr('src') || '';
      $(el).attr('title', urlToTitle(src) || 'Embedded content');
      modified = true;
      count++;
    });
    if (modified) saveHtml($, file);
  }
  return { applied: count > 0, details: `Added title to ${count} iframe(s)` };
}

// ─── Fix: meta-viewport (no user-scalable=no) ─────────────────────────────────

export async function fixMetaViewport(sitePath) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    const $vp = $('meta[name="viewport"]');
    if ($vp.length === 0) {
      $('head').append('<meta name="viewport" content="width=device-width, initial-scale=1">');
      saveHtml($, file);
      count++;
    } else {
      const content = $vp.attr('content') || '';
      if (/user-scalable\s*=\s*no/i.test(content) || /maximum-scale\s*=\s*1/i.test(content)) {
        const fixed = content
          .replace(/,?\s*user-scalable\s*=\s*no/gi, '')
          .replace(/,?\s*maximum-scale\s*=\s*1(\.\d+)?/gi, '');
        $vp.attr('content', fixed);
        saveHtml($, file);
        count++;
      }
    }
  }
  return { applied: count > 0, details: `Fixed viewport meta in ${count} file(s)` };
}

// ─── Fix: SEO — hreflang ──────────────────────────────────────────────────────

export async function fixHtmlLangMeta(sitePath, targetUrl) {
  const files = await findHtmlFiles(sitePath);
  let count = 0;
  for (const file of files) {
    const $ = loadHtml(file);
    if ($('link[hreflang]').length === 0 && $('html').attr('lang')) {
      const lang = $('html').attr('lang');
      const relPath = path.relative(sitePath, file).replace(/\\/g, '/').replace(/index\.html$/, '');
      const url = targetUrl.replace(/\/$/, '') + '/' + relPath;
      $('head').append(`<link rel="alternate" hreflang="${lang}" href="${url}">`);
      saveHtml($, file);
      count++;
    }
  }
  return { applied: count > 0, details: `Added hreflang to ${count} file(s)` };
}

// ─── Utilities ─────────────────────────────────────────────────────────────────

function generateAltFromSrc(src) {
  const filename = path.basename(src, path.extname(src));
  return toTitleCase(filename.replace(/[-_]/g, ' '));
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function escapeAttr(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function resolveAsset(sitePath, htmlFile, src) {
  if (src.startsWith('/')) return path.join(sitePath, src);
  return path.resolve(path.dirname(htmlFile), src);
}

function hrefToLabel(href) {
  try {
    const url = new URL(href, 'https://example.com');
    const segs = url.pathname.split('/').filter(Boolean);
    return segs.length ? toTitleCase(segs[segs.length - 1].replace(/-/g, ' ')) : null;
  } catch {
    return null;
  }
}

function urlToTitle(src) {
  if (!src) return null;
  if (src.includes('youtube.com') || src.includes('youtu.be')) return 'YouTube video';
  if (src.includes('vimeo.com')) return 'Vimeo video';
  if (src.includes('google.com/maps')) return 'Google Maps';
  if (src.includes('twitter.com') || src.includes('x.com')) return 'Twitter/X embed';
  return null;
}
