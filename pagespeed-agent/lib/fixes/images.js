import { glob } from 'glob';
import path from 'path';
import fs from 'fs-extra';
import * as cheerio from 'cheerio';

// ─── Convert images to WebP ───────────────────────────────────────────────────

export async function convertToWebP(sitePath) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return { applied: false, details: 'sharp not installed — run: npm install sharp' };
  }

  const images = await glob('**/*.{jpg,jpeg,png}', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let converted = 0;
  const mapping = {}; // oldPath → newWebpPath (relative to sitePath)

  for (const imgPath of images) {
    const webpPath = imgPath.replace(/\.(jpe?g|png)$/i, '.webp');
    if (await fs.pathExists(webpPath)) continue;
    try {
      await sharp(imgPath).webp({ quality: 82, effort: 4 }).toFile(webpPath);
      const rel = path.relative(sitePath, imgPath).replace(/\\/g, '/');
      const relWebp = path.relative(sitePath, webpPath).replace(/\\/g, '/');
      mapping[rel] = relWebp;
      converted++;
    } catch {}
  }

  // Update src references in HTML files
  if (converted > 0) {
    const htmlFiles = await glob('**/*.html', {
      cwd: sitePath,
      absolute: true,
      ignore: ['**/node_modules/**', '**/.git/**'],
    });

    for (const file of htmlFiles) {
      let html = await fs.readFile(file, 'utf8');
      let changed = false;
      for (const [oldRel, newRel] of Object.entries(mapping)) {
        const oldName = path.basename(oldRel);
        const newName = path.basename(newRel);
        if (html.includes(oldName)) {
          html = html.replaceAll(oldName, newName);
          changed = true;
        }
      }
      if (changed) await fs.writeFile(file, html, 'utf8');
    }
  }

  return { applied: converted > 0, details: `Converted ${converted} image(s) to WebP` };
}

// ─── Compress images ──────────────────────────────────────────────────────────

export async function compressImages(sitePath) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return { applied: false, details: 'sharp not installed' };
  }

  const images = await glob('**/*.{jpg,jpeg,png,webp}', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let compressed = 0;
  for (const imgPath of images) {
    const stat = await fs.stat(imgPath);
    if (stat.size < 50_000) continue; // Skip already-small images

    try {
      const ext = path.extname(imgPath).toLowerCase();
      const tmp = imgPath + '.tmp';

      if (ext === '.webp') {
        await sharp(imgPath).webp({ quality: 82, effort: 4 }).toFile(tmp);
      } else if (ext === '.png') {
        await sharp(imgPath).png({ quality: 85, compressionLevel: 9 }).toFile(tmp);
      } else {
        await sharp(imgPath).jpeg({ quality: 82, progressive: true }).toFile(tmp);
      }

      const newStat = await fs.stat(tmp);
      if (newStat.size < stat.size * 0.9) {
        await fs.move(tmp, imgPath, { overwrite: true });
        compressed++;
      } else {
        await fs.remove(tmp);
      }
    } catch {}
  }

  return { applied: compressed > 0, details: `Compressed ${compressed} image(s)` };
}

// ─── Add srcset for responsive images ────────────────────────────────────────

export async function addResponsiveSrcset(sitePath) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return { applied: false, details: 'sharp not installed' };
  }

  const WIDTHS = [400, 800, 1200];

  const htmlFiles = await glob('**/*.html', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let count = 0;
  for (const file of htmlFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const $ = cheerio.load(raw, { decodeEntities: false });
    let modified = false;

    for (const el of $('img').toArray()) {
      const $el = $(el);
      if ($el.attr('srcset')) continue;
      const src = $el.attr('src') || '';
      if (!src || src.startsWith('http') || src.startsWith('data:')) continue;
      if (!/\.(jpe?g|png|webp)$/i.test(src)) continue;

      const imgPath = src.startsWith('/')
        ? path.join(sitePath, src)
        : path.resolve(path.dirname(file), src);

      if (!await fs.pathExists(imgPath)) continue;

      try {
        const meta = await sharp(imgPath).metadata();
        const srcset = [];
        const ext = path.extname(imgPath);
        const base = imgPath.replace(ext, '');
        const baseSrc = src.replace(ext, '');

        for (const w of WIDTHS) {
          if (w >= (meta.width || 0)) continue;
          const outPath = `${base}-${w}w${ext}`;
          if (!await fs.pathExists(outPath)) {
            await sharp(imgPath).resize(w).toFile(outPath);
          }
          srcset.push(`${baseSrc}-${w}w${ext} ${w}w`);
        }

        if (srcset.length > 0) {
          $el.attr('srcset', srcset.join(', '));
          $el.attr('sizes', '(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px');
          modified = true;
          count++;
        }
      } catch {}
    }

    if (modified) await fs.writeFile(file, $.html(), 'utf8');
  }

  return { applied: count > 0, details: `Added srcset to ${count} image(s)` };
}

// ─── Add explicit width/height to img tags ────────────────────────────────────

export async function addImageDimensions(sitePath) {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    return { applied: false, details: 'sharp not installed' };
  }

  const htmlFiles = await glob('**/*.html', {
    cwd: sitePath,
    absolute: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });

  let count = 0;
  for (const file of htmlFiles) {
    const raw = await fs.readFile(file, 'utf8');
    const $ = cheerio.load(raw, { decodeEntities: false });
    let modified = false;

    for (const el of $('img').toArray()) {
      const $el = $(el);
      if ($el.attr('width') && $el.attr('height')) continue;
      const src = $el.attr('src') || '';
      if (!src || src.startsWith('http') || src.startsWith('data:')) continue;

      const imgPath = src.startsWith('/')
        ? path.join(sitePath, src)
        : path.resolve(path.dirname(file), src);

      if (!await fs.pathExists(imgPath)) continue;

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

    if (modified) await fs.writeFile(file, $.html(), 'utf8');
  }

  return { applied: count > 0, details: `Added dimensions to ${count} image(s)` };
}
