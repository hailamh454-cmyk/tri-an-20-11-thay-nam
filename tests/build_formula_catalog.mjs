import fs from 'fs';
import path from 'path';
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages.js';
import { Image } from '@napi-rs/canvas';
import { FORMULA_CATALOG } from '../tests/test_catalog_compile.mjs';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages.AllPackages || AllPackages });
const svgJax = new SVG({ fontCache: 'local' });
const doc = mathjax.document('', { InputJax: tex, OutputJax: svgJax });

console.log('Generating precompiled formula catalog...');

const items = [];
for (const item of FORMULA_CATALOG) {
  const node = doc.convert(item.latex, { display: true });
  let svgStr = adaptor.innerHTML(node);

  // Extract viewBox
  const vbMatch = svgStr.match(/viewBox=\"([^\"]+)\"/);
  const viewBox = vbMatch ? vbMatch[1] : '';

  // Clean SVG and ensure currentColor / target color attributes
  svgStr = svgStr.replace(/<svg/, `<svg color="${item.color}" fill="${item.color}" stroke="${item.color}"`);

  // Measure exact rendered dimensions using Image
  const img = new Image();
  img.src = Buffer.from(svgStr);
  const width = img.width || 150;
  const height = img.height || 36;

  items.push({
    id: item.id,
    name: item.name,
    category: item.category,
    latex: item.latex,
    color: item.color,
    width,
    height,
    viewBox,
    svg: svgStr
  });
}

console.log(`Generated ${items.length} formula items.`);

const fileContent = `/**
 * formulaCatalog.js
 * Precompiled High-Resolution Vector SVG Physics Formulas (88 formulas across 6 pillars).
 * Generated with MathJax 3 with exact natural pixel bounding boxes.
 */

export const CHALK_COLORS = {
  WHITE: '#f8fafc',
  YELLOW: '#fef08a',
  CYAN: '#93c5fd',
  RED: '#fca5a5'
};

export const FORMULA_CATALOG = ${JSON.stringify(items, null, 2)};

export default FORMULA_CATALOG;
`;

const outputPath = path.resolve('js/engine/formulaCatalog.js');
fs.writeFileSync(outputPath, fileContent, 'utf-8');
console.log(`Successfully wrote ${outputPath} (${(fileContent.length / 1024).toFixed(1)} KB)!`);
