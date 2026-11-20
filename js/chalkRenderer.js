/**
 * chalkRenderer.js
 * High-DPI Multi-Layer Canvas Engine, Procedural Slate Texture,
 * Offscreen Bristle Brush Caching, and Custom 2D Math Formula Renderer.
 * Strictly avoids printing raw LaTeX strings to 2D Canvas.
 */

export class ChalkRenderer {
  constructor() {
    this.brushSpriteWhite = null;
    this.brushSpriteYellow = null;
    this.brushSpriteCyan = null;
    this.brushSpriteRed = null;
    this.lectureImages = {};
    this.initBrushes();
    this.initLectureImages();
  }

  /**
   * Preloads optional handwritten lecture images from assets/lecture_level{1,2,3}.png.
   */
  initLectureImages() {
    // Rely on procedural STIX Two Math vector formula rendering (prevents spurious 404 network requests)
    this.lectureImages = {};
  }

  /**
   * Pre-renders multi-bristle chalk stamps into offscreen canvas sprites
   * to guarantee locked 60 FPS performance without canvas lag.
   */
  initBrushes() {
    if (typeof document === 'undefined') return;
    this.brushSpriteWhite = this.createBristleSprite('#f8fafc', 16);
    this.brushSpriteYellow = this.createBristleSprite('#fef08a', 16);
    this.brushSpriteCyan = this.createBristleSprite('#93c5fd', 16);
    this.brushSpriteRed = this.createBristleSprite('#fca5a5', 16);
  }

  createBristleSprite(colorHex, size) {
    if (typeof document === 'undefined') return null;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const ctx = off.getContext('2d');

    const center = size / 2;
    const radius = size / 2.2;

    // Draw clustered microscopic bristles with varying opacity
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.75) * radius;
      const x = center + Math.cos(angle) * r;
      const y = center + Math.sin(angle) * r;
      const alpha = 0.15 + Math.random() * 0.45;

      ctx.fillStyle = colorHex;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(x, y, 0.6 + Math.random() * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    return off;
  }

  getBrush(color) {
    if (color && color.includes('fef08a')) return this.brushSpriteYellow;
    if (color && (color.includes('93c5fd') || color.includes('cyan'))) return this.brushSpriteCyan;
    if (color && (color.includes('fca5a5') || color.includes('red'))) return this.brushSpriteRed;
    return this.brushSpriteWhite;
  }

  /**
   * Generates realistic procedural deep slate texture with erased chalk clouds & micro-scratches.
   */
  renderSlateBackground(canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;

    // Base deep slate gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#192f27');
    grad.addColorStop(0.5, '#14261f');
    grad.addColorStop(1, '#0e1c17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Micro-grain noise overlay
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 14;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    // Old erased chalk dust clouds (semitransparent soft washes)
    ctx.save();
    for (let c = 0; c < 12; c++) {
      const cx = Math.random() * w;
      const cy = Math.random() * h;
      const cr = 60 + Math.random() * 180;
      const cloudGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, cr);
      cloudGrad.addColorStop(0, 'rgba(235, 245, 240, 0.045)');
      cloudGrad.addColorStop(0.6, 'rgba(220, 235, 230, 0.02)');
      cloudGrad.addColorStop(1, 'rgba(200, 220, 210, 0)');

      ctx.fillStyle = cloudGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Faint horizontal wipe streaks left by old erasers
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 18;
    for (let y = 30; y < h; y += 45 + Math.random() * 20) {
      ctx.beginPath();
      ctx.moveTo(0, y + (Math.random() - 0.5) * 15);
      ctx.bezierCurveTo(
        w * 0.3, y + (Math.random() - 0.5) * 20,
        w * 0.7, y + (Math.random() - 0.5) * 20,
        w, y + (Math.random() - 0.5) * 15
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Draws a textured chalk stroke between two points.
   */
  drawChalkLine(ctx, x1, y1, x2, y2, color = '#f8fafc', width = 2.5) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;

    const brush = this.getBrush(color);
    if (!brush) {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.restore();
      return;
    }

    const steps = Math.max(Math.floor(dist / 2), 1);
    const stepX = dx / steps;
    const stepY = dy / steps;

    ctx.save();
    for (let i = 0; i <= steps; i++) {
      const jitterX = (Math.random() - 0.5) * 1.2;
      const jitterY = (Math.random() - 0.5) * 1.2;
      const curX = x1 + stepX * i + jitterX;
      const curY = y1 + stepY * i + jitterY;

      const size = width * (0.85 + Math.random() * 0.3);
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.drawImage(brush, curX - size / 2, curY - size / 2, size, size);
    }
    ctx.restore();
  }

  /**
   * Draws a dashed chalk curve or line (used for physics trajectory traces).
   */
  drawChalkDashedLine(ctx, points, color = '#f8fafc', width = 2) {
    if (!points || points.length < 2) return;
    for (let i = 0; i < points.length - 1; i += 2) {
      const p1 = points[i];
      const p2 = points[i + 1] || points[i];
      this.drawChalkLine(ctx, p1.x, p1.y, p2.x, p2.y, color, width);
    }
  }

  /**
   * Draws a chalk circle or planetary body.
   */
  drawChalkCircle(ctx, cx, cy, radius, color = '#f8fafc', isFilled = false) {
    const steps = Math.max(36, Math.floor(radius * 1.8));
    ctx.save();
    for (let i = 0; i < steps; i++) {
      const a1 = (i / steps) * Math.PI * 2;
      const a2 = ((i + 1) / steps) * Math.PI * 2;
      const rJitter1 = radius + (Math.random() - 0.5) * 1.5;
      const rJitter2 = radius + (Math.random() - 0.5) * 1.5;

      const x1 = cx + Math.cos(a1) * rJitter1;
      const y1 = cy + Math.sin(a1) * rJitter1;
      const x2 = cx + Math.cos(a2) * rJitter2;
      const y2 = cy + Math.sin(a2) * rJitter2;

      this.drawChalkLine(ctx, x1, y1, x2, y2, color, 2.2);
    }

    if (isFilled) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Draws a chalkboard vector arrow with chalk arrowheads.
   */
  drawChalkVectorArrow(ctx, x1, y1, x2, y2, color = '#fca5a5', width = 2) {
    this.drawChalkLine(ctx, x1, y1, x2, y2, color, width);

    // Arrowhead calculations adapted to line length
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const headLen = Math.max(4.5, Math.min(10, len * 0.38));
    const arrowAngle = Math.PI / 6;

    const leftX = x2 - headLen * Math.cos(angle - arrowAngle);
    const leftY = y2 - headLen * Math.sin(angle - arrowAngle);
    const rightX = x2 - headLen * Math.cos(angle + arrowAngle);
    const rightY = y2 - headLen * Math.sin(angle + arrowAngle);

    this.drawChalkLine(ctx, x2, y2, leftX, leftY, color, width * 0.9);
    this.drawChalkLine(ctx, x2, y2, rightX, rightY, color, width * 0.9);
  }

  /**
   * Renders realistic handwritten chalk text with subtle micro-jitter.
   */
  drawChalkText(ctx, text, x, y, options = {}) {
    const {
      font = "20px 'Caveat', cursive",
      color = '#f8fafc',
      align = 'left',
      baseline = 'alphabetic',
      alpha = 0.95
    } = options;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;

    // Render 2 passes with microscopic sub-pixel offset to simulate chalk grain
    ctx.fillText(text, x - 0.4, y - 0.3);
    ctx.fillText(text, x + 0.4, y + 0.3);
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ==========================================================================
     CUSTOM 2D MATH FORMULA RENDERER
     Renders fractions with real horizontal division bar, superscripts,
     subscripts, radicals with vinculum, and vector arrow decorations.
     ========================================================================== */

  /**
   * Draws a text segment with real subscript rendering when '_' is present (e.g. "8 π G M k_B").
   */
  _drawMathWithSubscript(ctx, text, centerX, centerY, fontSize, color) {
    if (!text.includes('_')) {
      this.drawChalkText(ctx, text, centerX, centerY, {
        font: `italic ${fontSize}px 'STIX Two Math', serif`,
        color,
        align: 'center',
        baseline: 'middle'
      });
      return;
    }

    const parts = text.split('_');
    const mainFont = `italic ${fontSize}px 'STIX Two Math', serif`;
    const subFont = `${Math.round(fontSize * 0.72)}px 'STIX Two Math', serif`;

    ctx.save();
    ctx.font = mainFont;
    let totalW = 0;
    const segments = [];
    for (let i = 0; i < parts.length; i++) {
      if (i === 0) {
        ctx.font = mainFont;
        const w = ctx.measureText(parts[i]).width;
        segments.push({ text: parts[i], font: mainFont, w, dy: 0 });
        totalW += w;
      } else {
        const subPart = parts[i].slice(0, 1);
        const restPart = parts[i].slice(1);
        ctx.font = subFont;
        const sw = ctx.measureText(subPart).width;
        segments.push({ text: subPart, font: subFont, w: sw, dy: fontSize * 0.22 });
        totalW += sw;
        if (restPart) {
          ctx.font = mainFont;
          const rw = ctx.measureText(restPart).width;
          segments.push({ text: restPart, font: mainFont, w: rw, dy: 0 });
          totalW += rw;
        }
      }
    }

    let curX = centerX - totalW * 0.5;
    for (const seg of segments) {
      this.drawChalkText(ctx, seg.text, curX, centerY + seg.dy, {
        font: seg.font,
        color,
        align: 'left',
        baseline: 'middle'
      });
      curX += seg.w;
    }
    ctx.restore();
  }

  /**
   * Draws a fraction with an authentic chalk division line.
   */
  drawFraction(ctx, numText, denText, x, y, options = {}) {
    const fontSize = options.fontSize || 36;
    const color = options.color || '#f8fafc';
    const mathFont = `italic ${fontSize}px 'STIX Two Math', serif`;

    ctx.save();
    ctx.font = mathFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const numWidth = ctx.measureText(numText.replace(/_/g, '')).width;
    const denWidth = ctx.measureText(denText.replace(/_/g, '')).width;
    const barWidth = Math.max(numWidth, denWidth) + 16;

    const gap = fontSize * 0.65;

    // Draw numerator (above bar)
    this._drawMathWithSubscript(ctx, numText, x, y - gap, fontSize, color);

    // Draw horizontal fraction line
    this.drawChalkLine(ctx, x - barWidth / 2, y, x + barWidth / 2, y, color, 2.8);

    // Draw denominator (below bar)
    this._drawMathWithSubscript(ctx, denText, x, y + gap, fontSize, color);

    ctx.restore();
    return barWidth;
  }

  /**
   * Draws a symbol with an authentic vector arrow accent on top: e.g. \vec{F}, \vec{v}, \vec{r}.
   * Measures glyph width with ctx.measureText() and centers the vector arrow above the character.
   */
  drawVectorSymbol(ctx, symbol, x, y, options = {}) {
    const fontSize = options.fontSize || 36;
    const color = options.color || '#f8fafc';
    const font = `italic ${fontSize}px 'STIX Two Math', serif`;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const charMetrics = ctx.measureText(symbol);
    const charWidth = charMetrics.width;
    this.drawChalkText(ctx, symbol, x, y, { font, color, align: 'left' });

    // Italic font slants forward at the top: offset center by slant factor
    const italicSlant = fontSize * 0.12;
    const arrowSpan = Math.max(charWidth * 0.92, 13);
    const centerX = x + charWidth * 0.5 + italicSlant;
    const arrowX1 = Math.round(centerX - arrowSpan * 0.5);
    const arrowX2 = Math.round(centerX + arrowSpan * 0.5);

    // Capital letters (F, V, B, E, L) are taller than lowercase (r, v, a)
    const isUpper = symbol === symbol.toUpperCase() && symbol !== symbol.toLowerCase();
    const arrowY = Math.round(y - (isUpper ? fontSize * 0.94 : fontSize * 0.82));

    // Draw connected horizontal stem line plus proportional arrowhead
    const strokeWidth = Math.max(1.8, fontSize * 0.058);
    this.drawChalkLine(ctx, arrowX1, arrowY, arrowX2, arrowY, color, strokeWidth);

    // Sharp, crisp chalk arrowhead at arrow tip (arrowX2, arrowY)
    const headLen = Math.max(4.5, Math.min(6.8, fontSize * 0.16));
    const headAngle = Math.PI / 5.5; // ~32 degrees
    const barbTopX = arrowX2 - headLen * Math.cos(headAngle);
    const barbTopY = arrowY - headLen * Math.sin(headAngle);
    const barbBotX = arrowX2 - headLen * Math.cos(headAngle);
    const barbBotY = arrowY + headLen * Math.sin(headAngle);

    this.drawChalkLine(ctx, arrowX2, arrowY, barbTopX, barbTopY, color, strokeWidth * 0.9);
    this.drawChalkLine(ctx, arrowX2, arrowY, barbBotX, barbBotY, color, strokeWidth * 0.9);

    ctx.restore();
    return Math.max(charWidth, arrowSpan) + 4;
  }

  /**
   * Draws a symbol with superscript and/or subscript: e.g. v_0^2, U_eff(r), R_{mu nu}.
   */
  drawSuperSub(ctx, baseText, supText, subText, x, y, options = {}) {
    const fontSize = options.fontSize || 36;
    const color = options.color || '#f8fafc';
    const font = `italic ${fontSize}px 'STIX Two Math', serif`;
    const smallFont = `${Math.round(fontSize * 0.7)}px 'STIX Two Math', serif`;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Base text
    this.drawChalkText(ctx, baseText, x, y, { font, color, align: 'left' });
    const baseWidth = ctx.measureText(baseText).width;

    let totalSubWidth = 0;
    if (subText) {
      this.drawChalkText(ctx, subText, x + baseWidth + 1, y + fontSize * 0.25, {
        font: smallFont,
        color,
        align: 'left'
      });
      ctx.font = smallFont;
      totalSubWidth = ctx.measureText(subText).width;
    }

    let totalSupWidth = 0;
    if (supText) {
      this.drawChalkText(ctx, supText, x + baseWidth + 1, y - fontSize * 0.55, {
        font: smallFont,
        color,
        align: 'left'
      });
      ctx.font = smallFont;
      totalSupWidth = ctx.measureText(supText).width;
    }

    ctx.restore();
    return baseWidth + Math.max(totalSubWidth, totalSupWidth) + 3;
  }

  /**
   * Draws a radical / square root with horizontal vinculum over the expression.
   */
  drawSquareRoot(ctx, innerText, x, y, options = {}) {
    const fontSize = options.fontSize || 36;
    const color = options.color || '#f8fafc';
    const font = `italic ${fontSize}px 'STIX Two Math', serif`;

    ctx.save();
    ctx.font = font;
    const innerWidth = ctx.measureText(innerText).width;

    // Radical hook
    const rootSymbol = '√';
    this.drawChalkText(ctx, rootSymbol, x, y, { font: `${Math.round(fontSize * 1.15)}px 'STIX Two Math', serif`, color });
    const hookWidth = ctx.measureText(rootSymbol).width * 0.85;

    // Top vinculum bar extending over the inner expression
    const barY = y - fontSize * 0.85;
    this.drawChalkLine(ctx, x + hookWidth, barY, x + hookWidth + innerWidth + 4, barY, color, 2.2);

    // Inner text
    this.drawChalkText(ctx, innerText, x + hookWidth + 3, y, { font, color });

    ctx.restore();
    return hookWidth + innerWidth + 8;
  }

  /**
   * Renders curated, large handwritten Vietnamese chalk titles & crisp STIX Two Math formulas.
   * Prefers optional pre-rendered lecture images at assets/lecture_level{1,2,3}.png if available.
   */
  renderLevelLectureFormulas(ctx, levelId, boardWidth, boardHeight) {
    // Optional preloaded handwritten lecture image support (assets/lecture_level{1,2,3}.png)
    const lectureImg = this.lectureImages && this.lectureImages[levelId];
    if (lectureImg && lectureImg.complete && lectureImg.naturalWidth > 0) {
      ctx.save();
      const targetW = Math.min(650, Math.max(500, lectureImg.naturalWidth));
      const targetH = targetW * (lectureImg.naturalHeight / lectureImg.naturalWidth);
      ctx.drawImage(lectureImg, 50, 45, targetW, targetH);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(70, 70);
    ctx.rotate(-0.01);

    const titleFont = "42px 'Patrick Hand', cursive";
    const mathFont = "italic 34px 'STIX Two Math', serif";
    const opFont = "34px 'STIX Two Math', serif";

    if (levelId === 1) {
      const title = "Bài 1: Chuyển động ném xiên";
      this.drawChalkText(ctx, title, 0, 0, { font: titleFont, color: '#fef08a' });
      this.drawChalkLine(ctx, 0, 14, 480, 14, 'rgba(254, 240, 138, 0.75)', 2.8);

      // Formula 1: y(x) = x tanα − (g · x²) / (2 v₀² cos²α)
      let curX = 0;
      const y1 = 80;
      this.drawChalkText(ctx, "y(x) = x tan α −", curX, y1, { font: opFont, color: '#f8fafc' });
      curX += 295;
      this.drawFraction(ctx, "g · x²", "2 v₀² cos²α", curX, y1 - 8, { fontSize: 36, color: '#f8fafc' });

      // Formula 2: Tầm xa: R = (v₀² sin 2α) / g
      curX = 0;
      const y2 = 175;
      this.drawChalkText(ctx, "Tầm xa:", curX, y2, { font: titleFont, color: '#fef08a' });
      curX += 160;
      this.drawChalkText(ctx, "R =", curX, y2, { font: opFont, color: '#f8fafc' });
      curX += 130;
      this.drawFraction(ctx, "v₀² sin(2α)", "g", curX, y2 - 8, { fontSize: 36, color: '#f8fafc' });

    } else if (levelId === 2) {
      const title = "Bài 2: Cơ học thiên thể Kepler";
      this.drawChalkText(ctx, title, 0, 0, { font: titleFont, color: '#fef08a' });
      this.drawChalkLine(ctx, 0, 14, 520, 14, 'rgba(254, 240, 138, 0.75)', 2.8);

      // Formula 1: \vec{F} = −G (M·m / r³) \vec{r}
      let curX = 0;
      const y1 = 80;
      this.drawVectorSymbol(ctx, "F", curX, y1, { fontSize: 36, color: '#fca5a5' });
      curX += 32;
      this.drawChalkText(ctx, "= −", curX, y1, { font: opFont, color: '#f8fafc' });
      curX += 64;
      this.drawChalkText(ctx, "G", curX, y1, { font: mathFont, color: '#f8fafc' });
      curX += 78;
      this.drawFraction(ctx, "M · m", "r³", curX, y1 - 8, { fontSize: 36, color: '#f8fafc' });
      curX += 65;
      this.drawVectorSymbol(ctx, "r", curX, y1, { fontSize: 36, color: '#f8fafc' });

      // Formula 2: U_eff(r) = −(GMm/r) + (L²/2mr²)
      curX = 0;
      const y2 = 175;
      this.drawSuperSub(ctx, "U", null, "eff", curX, y2, { fontSize: 36, color: '#93c5fd' });
      curX += 68;
      this.drawChalkText(ctx, "(r) = −", curX, y2, { font: opFont, color: '#f8fafc' });
      curX += 155;
      this.drawFraction(ctx, "G M m", "r", curX, y2 - 8, { fontSize: 36, color: '#f8fafc' });
      curX += 80;
      this.drawChalkText(ctx, "+", curX, y2, { font: opFont, color: '#f8fafc' });
      curX += 90;
      this.drawFraction(ctx, "L²", "2 m r²", curX, y2 - 8, { fontSize: 36, color: '#f8fafc' });

    } else if (levelId === 3) {
      const title = "Bài 3: Hố đen Schwarzschild";
      this.drawChalkText(ctx, title, 0, 0, { font: titleFont, color: '#fef08a' });
      this.drawChalkLine(ctx, 0, 14, 480, 14, 'rgba(254, 240, 138, 0.75)', 2.8);

      // Formula 1: r_s = 2GM / c² & T_H = ℏc³ / (8π G M k_B)
      let curX = 0;
      const y1 = 80;
      this.drawSuperSub(ctx, "r", null, "s", curX, y1, { fontSize: 36, color: '#93c5fd' });
      curX += 36;
      this.drawChalkText(ctx, "=", curX, y1, { font: opFont, color: '#f8fafc' });
      curX += 85;
      this.drawFraction(ctx, "2 G M", "c²", curX, y1 - 8, { fontSize: 36, color: '#f8fafc' });
      curX += 95;

      this.drawSuperSub(ctx, "T", null, "H", curX, y1, { fontSize: 36, color: '#93c5fd' });
      curX += 46;
      this.drawChalkText(ctx, "=", curX, y1, { font: opFont, color: '#f8fafc' });
      curX += 120;
      this.drawFraction(ctx, "ℏ c³", "8 π G M k_B", curX, y1 - 8, { fontSize: 36, color: '#f8fafc' });

      // Formula 2: \vec{a} = −(GM/r³)\vec{r} − (3GM h² / c² r⁵)\vec{r}
      curX = 0;
      const y2 = 175;
      this.drawVectorSymbol(ctx, "a", curX, y2, { fontSize: 36, color: '#fca5a5' });
      curX += 32;
      this.drawChalkText(ctx, "= −", curX, y2, { font: opFont, color: '#f8fafc' });
      curX += 100;
      this.drawFraction(ctx, "G M", "r³", curX, y2 - 8, { fontSize: 36, color: '#f8fafc' });
      curX += 58;
      this.drawVectorSymbol(ctx, "r", curX, y2, { fontSize: 36, color: '#f8fafc' });
      curX += 32;
      this.drawChalkText(ctx, "−", curX, y2, { font: opFont, color: '#f8fafc' });
      curX += 95;
      this.drawFraction(ctx, "3 G M h²", "c² r⁵", curX, y2 - 8, { fontSize: 36, color: '#f8fafc' });
      curX += 85;
      this.drawVectorSymbol(ctx, "r", curX, y2, { fontSize: 36, color: '#f8fafc' });
    }

    ctx.restore();
  }
}
