import * as htmlFixes from './fixes/html.js';
import * as imageFixes from './fixes/images.js';
import * as cssFixes from './fixes/css.js';

// Maps every Lighthouse audit ID to its fix function + metadata.
// complexity: 1=trivial one-liner, 5=requires deep site-specific reasoning
const AUDIT_FIX_MAP = {
  // ── HTML / Meta ────────────────────────────────────────────────────────────
  'html-has-lang':             { fn: htmlFixes.addLangAttribute,   complexity: 1, auto: true },
  'doctype':                   { fn: htmlFixes.ensureDoctype,       complexity: 1, auto: true },
  'charset':                   { fn: htmlFixes.ensureCharset,       complexity: 1, auto: true },
  'document-title':            { fn: htmlFixes.ensureTitle,         complexity: 1, auto: true },
  'meta-description':          { fn: htmlFixes.ensureMetaDescription, complexity: 1, auto: true },
  'canonical':                 { fn: htmlFixes.ensureCanonical,     complexity: 1, auto: true },
  'meta-viewport':             { fn: htmlFixes.fixMetaViewport,     complexity: 1, auto: true },
  'is-crawlable':              { fn: htmlFixes.fixCrawlability,     complexity: 1, auto: true },

  // ── Accessibility ──────────────────────────────────────────────────────────
  'image-alt':                 { fn: htmlFixes.fixImageAlts,        complexity: 2, auto: true },
  'button-name':               { fn: htmlFixes.fixButtonNames,      complexity: 2, auto: true },
  'label':                     { fn: htmlFixes.fixFormLabels,       complexity: 2, auto: true },
  'link-name':                 { fn: htmlFixes.fixLinkNames,        complexity: 2, auto: true },
  'bypass':                    { fn: htmlFixes.addSkipLink,         complexity: 1, auto: true },
  'heading-order':             { fn: htmlFixes.fixHeadingOrder,     complexity: 2, auto: true },
  'frame-title':               { fn: htmlFixes.fixIframeTitles,     complexity: 1, auto: true },

  // ── Images ─────────────────────────────────────────────────────────────────
  'uses-webp-images':          { fn: imageFixes.convertToWebP,      complexity: 2, auto: true },
  'image-delivery-insight':    { fn: imageFixes.convertToWebP,      complexity: 2, auto: true },
  'offscreen-images':          { fn: htmlFixes.addLazyLoading,      complexity: 2, auto: true },
  'uses-responsive-images':    { fn: imageFixes.addResponsiveSrcset, complexity: 3, auto: true },
  'unsized-images':            { fn: imageFixes.addImageDimensions, complexity: 2, auto: true },
  'image-size-responsive':     { fn: imageFixes.addImageDimensions, complexity: 2, auto: true },
  'uses-optimized-images':     { fn: imageFixes.compressImages,     complexity: 2, auto: true },

  // ── Performance / JS ──────────────────────────────────────────────────────
  'render-blocking-resources': { fn: htmlFixes.deferScripts,        complexity: 2, auto: true },
  'render-blocking-insight':   { fn: htmlFixes.deferScripts,        complexity: 2, auto: true },
  'unminified-javascript':     { fn: cssFixes.minifyJs,             complexity: 2, auto: true },
  'unminified-css':            { fn: cssFixes.minifyCss,            complexity: 2, auto: true },
  'unused-css-rules':          { fn: cssFixes.purgeUnusedCss,       complexity: 3, auto: true },
  'uses-text-compression':     { fn: cssFixes.preCompressAssets,    complexity: 2, auto: true },

  // ── Fonts ──────────────────────────────────────────────────────────────────
  'font-display':              { fn: cssFixes.fixFontDisplay,       complexity: 2, auto: true },
  'font-display-insight':      { fn: cssFixes.fixFontDisplay,       complexity: 2, auto: true },

  // ── LCP / Preload ──────────────────────────────────────────────────────────
  'uses-rel-preconnect':       { fn: null, complexity: 2, auto: false,
    note: 'Call htmlFixes.addPreconnect(sitePath, origins) with detected origins' },
  'lcp-discovery-insight':     { fn: null, complexity: 3, auto: false,
    note: 'Call htmlFixes.optimizeLCP(sitePath, lcpSrc) with detected LCP resource' },
  'uses-rel-preload':          { fn: null, complexity: 3, auto: false,
    note: 'Call htmlFixes.optimizeLCP(sitePath, lcpSrc)' },

  // ── Manual / architectural ─────────────────────────────────────────────────
  'unused-javascript':         { fn: null, complexity: 4, auto: false,
    note: 'Requires code splitting — add dynamic import() in framework build config' },
  'bootup-time':               { fn: null, complexity: 4, auto: false,
    note: 'Defer/lazy-load heavy third-party scripts' },
  'long-tasks':                { fn: null, complexity: 5, auto: false,
    note: 'Break up long tasks with scheduler.yield() — architectural change' },
  'bf-cache':                  { fn: null, complexity: 3, auto: false,
    note: 'Remove Cache-Control: no-store and unload event listeners' },
  'color-contrast':            { fn: null, complexity: 3, auto: false,
    note: 'Adjust CSS color values to meet 4.5:1 contrast ratio — requires design review' },
  'third-party-cookies':       { fn: null, complexity: 5, auto: false,
    note: 'Migrate analytics/ads to first-party — business decision required' },
  'csp-xss':                   { fn: null, complexity: 4, auto: false,
    note: 'Add Content-Security-Policy header — see server.js output' },
  'server-response-time':      { fn: null, complexity: 4, auto: false,
    note: 'Enable server caching, CDN, or optimize database queries' },
  'non-composited-animations': { fn: null, complexity: 4, auto: false,
    note: 'Use only transform/opacity for animations in CSS' },
  'dom-size-insight':          { fn: null, complexity: 4, auto: false,
    note: 'Virtualize long lists, remove hidden DOM elements' },
  'duplicated-javascript-insight': { fn: null, complexity: 3, auto: false,
    note: 'Deduplicate bundle chunks in your bundler config' },
  'legacy-javascript-insight': { fn: null, complexity: 3, auto: false,
    note: 'Update browserslist targets, remove IE polyfills' },
  'link-text':                 { fn: null, complexity: 3, auto: false,
    note: 'Replace generic link text ("click here") with descriptive text' },
};

// Score impact formula: higher = fix this first
function impactScore(audit) {
  const meta = AUDIT_FIX_MAP[audit.id] || { complexity: 5 };
  const gain = (1 - audit.score) * audit.weight;
  return gain / meta.complexity;
}

export function prioritize(failedAudits) {
  return [...failedAudits].sort((a, b) => impactScore(b) - impactScore(a));
}

export function getFixable(failedAudits) {
  return failedAudits.filter(a => {
    const meta = AUDIT_FIX_MAP[a.id];
    return meta && meta.fn !== null;
  });
}

export function getManual(failedAudits) {
  return failedAudits.filter(a => {
    const meta = AUDIT_FIX_MAP[a.id];
    return meta && meta.fn === null;
  });
}

export async function applyFix(audit, context) {
  const meta = AUDIT_FIX_MAP[audit.id];
  if (!meta || !meta.fn) {
    return { applied: false, details: meta?.note || 'No automated fix available' };
  }

  try {
    // Special cases that need extra context
    if (audit.id === 'uses-rel-preconnect') {
      return await htmlFixes.addPreconnect(context.sitePath, context.thirdPartyOrigins || []);
    }
    if (audit.id === 'lcp-discovery-insight' || audit.id === 'uses-rel-preload') {
      return await htmlFixes.optimizeLCP(context.sitePath, context.lcpSrc);
    }
    if (audit.id === 'offscreen-images') {
      return await htmlFixes.addLazyLoading(context.sitePath, context.lcpSrc);
    }
    if (audit.id === 'canonical') {
      return await htmlFixes.ensureCanonical(context.sitePath, context.targetUrl);
    }
    if (audit.id === 'image-alt') {
      return await htmlFixes.fixImageAlts(context.sitePath, context.anthropic);
    }

    // Default: pass sitePath only
    return await meta.fn(context.sitePath);
  } catch (err) {
    return { applied: false, details: `Fix threw an error: ${err.message}` };
  }
}

export function getNote(auditId) {
  return AUDIT_FIX_MAP[auditId]?.note || null;
}

export { AUDIT_FIX_MAP };
