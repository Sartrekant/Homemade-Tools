import axios from 'axios';

const PSI_BASE = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

export async function runAnalysis(url, strategy, apiKey) {
  const params = new URLSearchParams({ url, strategy, key: apiKey });
  for (const cat of CATEGORIES) params.append('category', cat);

  const res = await axios.get(`${PSI_BASE}?${params}`, { timeout: 120_000 });
  return res.data;
}

export async function runAnalysisWithRetry(url, strategy, apiKey, runs = 3) {
  const scores = [];
  const results = [];

  for (let i = 0; i < runs; i++) {
    try {
      const result = await runAnalysis(url, strategy, apiKey);
      scores.push(extractScores(result));
      results.push(result);
      if (i < runs - 1) await sleep(5000);
    } catch (err) {
      if (err.response?.status === 429) {
        await sleep(30_000);
        i--;
      } else {
        console.error(`PSI run ${i + 1} failed: ${err.message}`);
      }
    }
  }

  if (results.length === 0) throw new Error('All PSI API calls failed');

  // Return the result closest to the median performance score
  const perfScores = scores.map(s => s.performance).sort((a, b) => a - b);
  const median = perfScores[Math.floor(perfScores.length / 2)];
  const bestIdx = scores.findIndex(s => s.performance === median);
  return { result: results[bestIdx ?? 0], scores: scores[bestIdx ?? 0] };
}

export function extractScores(lhr) {
  const cats = lhr.lighthouseResult?.categories || {};
  return {
    performance: Math.round((cats.performance?.score ?? 0) * 100),
    accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPractices: Math.round((cats['best-practices']?.score ?? 0) * 100),
    seo: Math.round((cats.seo?.score ?? 0) * 100),
  };
}

export function extractFailedAudits(lhr) {
  const audits = lhr.lighthouseResult?.audits || {};
  const categories = lhr.lighthouseResult?.categories || {};

  // Build a map of auditId → {category, weight}
  const auditMeta = {};
  for (const [catId, cat] of Object.entries(categories)) {
    for (const ref of cat.auditRefs || []) {
      if (ref.weight > 0) {
        auditMeta[ref.id] = { category: catId, weight: ref.weight };
      }
    }
  }

  const failed = [];
  for (const [id, audit] of Object.entries(audits)) {
    // Skip non-scoring audits
    if (
      audit.scoreDisplayMode === 'notApplicable' ||
      audit.scoreDisplayMode === 'informative' ||
      audit.scoreDisplayMode === 'manual' ||
      audit.score === null ||
      audit.score === 1
    ) continue;

    const meta = auditMeta[id];
    if (!meta) continue;

    failed.push({
      id,
      title: audit.title,
      description: audit.description,
      score: audit.score ?? 0,
      category: meta.category,
      weight: meta.weight,
      details: audit.details,
      numericValue: audit.numericValue,
      displayValue: audit.displayValue,
      wastedMs: audit.details?.overallSavingsMs ?? 0,
      wastedBytes: audit.details?.overallSavingsBytes ?? 0,
    });
  }

  return failed;
}

export function extractLCPResource(lhr) {
  const lcpAudit = lhr.lighthouseResult?.audits?.['largest-contentful-paint'];
  const lcpElement = lhr.lighthouseResult?.audits?.['largest-contentful-paint-element'];
  return {
    element: lcpElement?.details?.items?.[0]?.node?.snippet || null,
    src: extractSrcFromSnippet(lcpElement?.details?.items?.[0]?.node?.snippet),
    ms: lcpAudit?.numericValue || 0,
  };
}

export function extractThirdPartyOrigins(lhr) {
  const tpAudit = lhr.lighthouseResult?.audits?.['third-party-summary'];
  const origins = new Set();
  for (const item of tpAudit?.details?.items || []) {
    if (item.entity) origins.add(item.entity);
    if (item.url) {
      try { origins.add(new URL(item.url).origin); } catch {}
    }
  }
  return [...origins];
}

function extractSrcFromSnippet(snippet) {
  if (!snippet) return null;
  const match = snippet.match(/src=["']([^"']+)["']/);
  return match?.[1] || null;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
