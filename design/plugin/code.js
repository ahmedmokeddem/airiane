// Haven — App Presentation Generator
// Plain JS, Figma Plugin API, no build step. Re-runnable: removes its own
// previous "App Presentation" page before rebuilding from scratch.

(function () {
  'use strict';

  var PAGE_NAME = 'App Presentation';
  var notes = [];

  function note(msg) { notes.push(msg); }

  // ---------------------------------------------------------------------
  // Color tokens (see design/design-system.md for the rationale + contrast
  // numbers). One ground, one ink, one accent; sage is a tonal secondary,
  // never a competing accent.
  // ---------------------------------------------------------------------
  function hex(h) {
    var v = parseInt(h.replace('#', ''), 16);
    return { r: ((v >> 16) & 255) / 255, g: ((v >> 8) & 255) / 255, b: (v & 255) / 255 };
  }

  var COLORS = {
    ground: hex('#F7F0E3'),
    surface: hex('#FFFBF3'),
    surfaceSage: hex('#96AC8B'),
    surfaceSageTint: hex('#E3E9DD'),
    accent: hex('#B85A3A'),
    accentTint: hex('#F0C9B4'),
    ink: hex('#3E2C22'),
    inkMuted: hex('#80705F'),
    onAccent: hex('#FFFFFF')
  };

  var SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48, huge: 64 };
  var RADIUS = { pill: 999, lg: 28, md: 20, badge: 20 };
  var CONTENT_W = 390 - SPACE.xl * 2; // usable width inside standard 24px screen padding

  var TEXT_STYLES = {
    display: { size: 28, weight: 'bold', lh: 34 },
    heading: { size: 20, weight: 'semibold', lh: 26 },
    body: { size: 16, weight: 'regular', lh: 23 },
    label: { size: 16, weight: 'semibold', lh: 20 },
    caption: { size: 13, weight: 'regular', lh: 18 }
  };

  var FONT = {}; // filled by resolveFonts()
  var styleIds = {}; // name -> style id, for paint/text styles

  // ---------------------------------------------------------------------
  // Font resolution: try a chain of friendly sans-serifs, fall back to
  // Inter. Figma can load bundled/Google fonts without local OS install,
  // but we still verify availability instead of assuming it.
  // ---------------------------------------------------------------------
  function resolveFonts(available) {
    var chain = ['Nunito', 'Quicksand', 'Poppins', 'Inter'];
    var byFamily = {};
    available.forEach(function (f) {
      var fam = f.fontName.family;
      if (!byFamily[fam]) byFamily[fam] = [];
      byFamily[fam].push(f.fontName.style);
    });

    var chosenFamily = null;
    for (var i = 0; i < chain.length; i++) {
      var fam = chain[i];
      if (byFamily[fam] && byFamily[fam].indexOf('Regular') !== -1) {
        chosenFamily = fam;
        break;
      }
    }
    if (!chosenFamily) {
      chosenFamily = 'Inter';
      byFamily['Inter'] = byFamily['Inter'] || ['Regular', 'Medium', 'Bold'];
    }

    function pick(prefs) {
      var styles = byFamily[chosenFamily] || ['Regular'];
      for (var j = 0; j < prefs.length; j++) {
        if (styles.indexOf(prefs[j]) !== -1) return { family: chosenFamily, style: prefs[j] };
      }
      return { family: chosenFamily, style: styles[0] || 'Regular' };
    }

    return {
      regular: pick(['Regular']),
      medium: pick(['Medium', 'SemiBold', 'Semi Bold', 'Bold', 'Regular']),
      semibold: pick(['SemiBold', 'Semi Bold', 'Medium', 'Bold', 'Regular']),
      bold: pick(['Bold', 'SemiBold', 'Semi Bold', 'Medium', 'Regular']),
      familyUsed: chosenFamily
    };
  }

  function weightFor(key) {
    if (key === 'bold') return FONT.bold;
    if (key === 'semibold') return FONT.semibold;
    if (key === 'regular') return FONT.regular;
    return FONT.regular;
  }

  async function loadAllFonts() {
    var combos = [FONT.regular, FONT.medium, FONT.semibold, FONT.bold];
    for (var i = 0; i < combos.length; i++) {
      try {
        await figma.loadFontAsync(combos[i]);
      } catch (e) {
        note('Font load failed for ' + combos[i].family + ' ' + combos[i].style + ', falling back to Inter Regular.');
        FONT.regular = FONT.medium = FONT.semibold = FONT.bold = { family: 'Inter', style: 'Regular' };
        await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Styles: Paint styles + text styles so the palette/type scale show up
  // in Figma's Styles panel and stay editable after the fact.
  // ---------------------------------------------------------------------
  function buildStyles() {
    var paintNames = {
      ground: 'Haven/Ground', surface: 'Haven/Surface', surfaceSage: 'Haven/Surface Sage',
      surfaceSageTint: 'Haven/Surface Sage Tint', accent: 'Haven/Accent', accentTint: 'Haven/Accent Tint',
      ink: 'Haven/Ink', inkMuted: 'Haven/Ink Muted', onAccent: 'Haven/On Accent'
    };
    Object.keys(paintNames).forEach(function (token) {
      try {
        var style = figma.createPaintStyle();
        style.name = paintNames[token];
        style.paints = [{ type: 'SOLID', color: COLORS[token] }];
        styleIds[token] = style.id;
      } catch (e) {
        note('Could not create paint style for ' + token + ': ' + e.message);
      }
    });

    Object.keys(TEXT_STYLES).forEach(function (key) {
      try {
        var def = TEXT_STYLES[key];
        var style = figma.createTextStyle();
        style.name = 'Haven/' + key.charAt(0).toUpperCase() + key.slice(1);
        style.fontName = weightFor(def.weight);
        style.fontSize = def.size;
        style.lineHeight = { value: def.lh, unit: 'PIXELS' };
        styleIds['text/' + key] = style.id;
      } catch (e) {
        note('Could not create text style for ' + key + ': ' + e.message);
      }
    });
  }

  // ---------------------------------------------------------------------
  // Primitive helpers
  // ---------------------------------------------------------------------
  function solidPaint(token) { return { type: 'SOLID', color: COLORS[token] }; }

  function setFill(node, token) {
    if (!token) { node.fills = []; return; }
    node.fills = [solidPaint(token)];
    try { if (styleIds[token]) node.fillStyleId = styleIds[token]; } catch (e) { /* not all node types bind the same way */ }
  }

  function box(name, opts) {
    opts = opts || {};
    var f = figma.createFrame();
    f.name = name;
    if (opts.dir === 'VERTICAL' || opts.dir === 'HORIZONTAL') {
      f.layoutMode = opts.dir;
      f.itemSpacing = opts.gap != null ? opts.gap : 0;
      var pad = opts.pad || 0;
      if (typeof pad === 'number') {
        f.paddingLeft = f.paddingRight = f.paddingTop = f.paddingBottom = pad;
      } else {
        f.paddingLeft = pad.l || 0; f.paddingRight = pad.r || 0;
        f.paddingTop = pad.t || 0; f.paddingBottom = pad.b || 0;
      }
      f.primaryAxisSizingMode = opts.primarySizing || 'AUTO';
      f.counterAxisSizingMode = opts.counterSizing || 'AUTO';
      f.primaryAxisAlignItems = opts.primaryAlign || 'MIN';
      f.counterAxisAlignItems = opts.counterAlign || 'MIN';
    } else {
      f.layoutMode = 'NONE';
    }
    f.clipsContent = opts.clip === true;
    if (opts.fill) setFill(f, opts.fill); else f.fills = [];
    if (opts.radius != null) f.cornerRadius = opts.radius;
    if (opts.w != null && opts.h != null) f.resize(opts.w, opts.h);
    return f;
  }

  function add(parent, child) { parent.appendChild(child); return child; }

  function fillH(node) { try { node.layoutSizingHorizontal = 'FILL'; } catch (e) { /* parent not auto-layout */ } }
  function fillV(node) { try { node.layoutSizingVertical = 'FILL'; } catch (e) { /* parent not auto-layout */ } }

  function txt(content, styleKey, colorToken, opts) {
    opts = opts || {};
    var t = figma.createText();
    var def = TEXT_STYLES[styleKey];
    t.fontName = weightFor(def.weight);
    t.characters = content;
    t.fontSize = def.size;
    t.lineHeight = { value: def.lh, unit: 'PIXELS' };
    setFill(t, colorToken);
    try { if (styleIds['text/' + styleKey]) t.textStyleId = styleIds['text/' + styleKey]; } catch (e) { /* ok */ }
    t.textAlignHorizontal = opts.align || 'LEFT';
    if (opts.w) { t.textAutoResize = 'HEIGHT'; t.resize(opts.w, Math.max(t.height, def.lh)); }
    else { t.textAutoResize = 'WIDTH_AND_HEIGHT'; }
    t.name = styleKey + ': ' + content.slice(0, 28);
    return t;
  }

  function rect(w, h, colorToken, radius) {
    var r = figma.createRectangle();
    r.resize(w, h);
    setFill(r, colorToken);
    if (radius != null) r.cornerRadius = radius;
    r.name = 'Rect';
    return r;
  }

  function ellipse(w, h, colorToken) {
    var e = figma.createEllipse();
    e.resize(w, h);
    setFill(e, colorToken);
    e.name = 'Ellipse';
    return e;
  }

  function place(node, x, y) { node.x = x; node.y = y; return node; }

  // Circular progress ring built from EllipseNode.arcData (donut segments) —
  // avoids any vector-stroke math.
  function ring(size, progress, trackToken, fillToken, thickness) {
    thickness = thickness || 0.12;
    var inner = 1 - thickness;
    var group = box('Ring', { w: size, h: size });
    var track = ellipse(size, size, trackToken);
    track.arcData = { startingAngle: 0, endingAngle: Math.PI * 2 * 0.9999, innerRadius: inner };
    var prog = ellipse(size, size, fillToken);
    var start = -Math.PI / 2;
    var sweep = Math.PI * 2 * Math.max(0.0008, Math.min(0.9999, progress));
    prog.arcData = { startingAngle: start, endingAngle: start + sweep, innerRadius: inner };
    add(group, track); place(track, 0, 0);
    add(group, prog); place(prog, 0, 0);
    return group;
  }

  // ---------------------------------------------------------------------
  // Icons — flat glyphs built from primitive shapes only (no vector path
  // strings, no icon font, no imported images).
  // ---------------------------------------------------------------------
  function iconFrame(size) {
    var f = box('Icon', { w: size, h: size });
    f.layoutMode = 'NONE';
    f.fills = [];
    f.clipsContent = false;
    return f;
  }

  function bar(w, h) { var r2 = figma.createRectangle(); r2.resize(w, h); r2.name = 'Bar'; return r2; }

  function icon(name, size, token) {
    var f = iconFrame(size);
    var s = size;
    var mk = function (w, h) { var r2 = bar(w, h); setFill(r2, token); return r2; };
    var mkE = function (w, h) { var e = ellipse(w, h, token); return e; };

    if (name === 'home') {
      var body = mk(s * 0.62, s * 0.42); body.cornerRadius = 2;
      add(f, body); place(body, s * 0.19, s * 0.42);
      var roof = figma.createPolygon(); roof.pointCount = 3; roof.resize(s * 0.74, s * 0.4);
      setFill(roof, token); add(f, roof); place(roof, s * 0.13, s * 0.06);
    } else if (name === 'treatment') {
      var leaf = mkE(s * 0.62, s * 0.42);
      leaf.rotation = 45; add(f, leaf); place(leaf, s * 0.2, s * 0.3);
    } else if (name === 'chat') {
      var bubble = mk(s * 0.78, s * 0.56); bubble.cornerRadius = s * 0.18;
      add(f, bubble); place(bubble, s * 0.11, s * 0.1);
      var tail = figma.createPolygon(); tail.pointCount = 3; tail.resize(s * 0.18, s * 0.16);
      tail.rotation = 200; setFill(tail, token);
      add(f, tail); place(tail, s * 0.22, s * 0.6);
    } else if (name === 'report') {
      var b1 = mk(s * 0.16, s * 0.3); add(f, b1); place(b1, s * 0.14, s * 0.56);
      var b2 = mk(s * 0.16, s * 0.48); add(f, b2); place(b2, s * 0.42, s * 0.38);
      var b3 = mk(s * 0.16, s * 0.66); add(f, b3); place(b3, s * 0.70, s * 0.2);
    } else if (name === 'back') {
      var chev = figma.createPolygon(); chev.pointCount = 3; chev.resize(s * 0.42, s * 0.5);
      chev.rotation = -90; setFill(chev, token);
      add(f, chev); place(chev, s * 0.28, s * 0.25);
    } else if (name === 'mic') {
      var mbody = mk(s * 0.34, s * 0.5); mbody.cornerRadius = s * 0.17;
      add(f, mbody); place(mbody, s * 0.33, s * 0.08);
      var stand = mk(s * 0.06, s * 0.2); add(f, stand); place(stand, s * 0.47, s * 0.58);
      var base = mk(s * 0.34, s * 0.06); base.cornerRadius = 3; add(f, base); place(base, s * 0.33, s * 0.78);
    } else if (name === 'camera') {
      var cbody = mk(s * 0.78, s * 0.52); cbody.cornerRadius = s * 0.1;
      add(f, cbody); place(cbody, s * 0.11, s * 0.28);
      var lens = mkE(s * 0.28, s * 0.28); add(f, lens); place(lens, s * 0.36, s * 0.4);
      var bump = mk(s * 0.22, s * 0.12); bump.cornerRadius = 3; add(f, bump); place(bump, s * 0.4, s * 0.14);
    } else if (name === 'play') {
      var tri = figma.createPolygon(); tri.pointCount = 3; tri.resize(s * 0.56, s * 0.64);
      tri.rotation = 90; setFill(tri, token);
      add(f, tri); place(tri, s * 0.26, s * 0.18);
    } else if (name === 'pause') {
      var p1 = mk(s * 0.2, s * 0.6); p1.cornerRadius = 2; add(f, p1); place(p1, s * 0.22, s * 0.2);
      var p2 = mk(s * 0.2, s * 0.6); p2.cornerRadius = 2; add(f, p2); place(p2, s * 0.58, s * 0.2);
    } else if (name === 'send') {
      var send = figma.createPolygon(); send.pointCount = 3; send.resize(s * 0.6, s * 0.6);
      send.rotation = 90; setFill(send, token);
      add(f, send); place(send, s * 0.2, s * 0.2);
    } else if (name === 'check') {
      var c1 = mk(s * 0.32, s * 0.12); c1.cornerRadius = 4; c1.rotation = 45;
      add(f, c1); place(c1, s * 0.16, s * 0.48);
      var c2 = mk(s * 0.52, s * 0.12); c2.cornerRadius = 4; c2.rotation = -45;
      add(f, c2); place(c2, s * 0.32, s * 0.4);
    } else if (name === 'close') {
      var x1 = mk(s * 0.64, s * 0.1); x1.cornerRadius = 3; x1.rotation = 45;
      add(f, x1); place(x1, s * 0.18, s * 0.45);
      var x2 = mk(s * 0.64, s * 0.1); x2.cornerRadius = 3; x2.rotation = -45;
      add(f, x2); place(x2, s * 0.18, s * 0.45);
    } else if (name === 'end-call') {
      var end = mkE(s * 0.7, s * 0.7); add(f, end); place(end, s * 0.15, s * 0.15);
    } else if (name === 'sound') {
      var h1 = mk(s * 0.16, s * 0.34); h1.cornerRadius = s * 0.08; add(f, h1); place(h1, s * 0.16, s * 0.4);
      var h2 = mk(s * 0.16, s * 0.6); h2.cornerRadius = s * 0.08; add(f, h2); place(h2, s * 0.42, s * 0.18);
      var h3 = mk(s * 0.16, s * 0.42); h3.cornerRadius = s * 0.08; add(f, h3); place(h3, s * 0.68, s * 0.32);
    } else {
      var dot = mkE(s * 0.4, s * 0.4); add(f, dot); place(dot, s * 0.3, s * 0.3);
    }
    return f;
  }

  // ---------------------------------------------------------------------
  // Logo — a terracotta squircle badge with two overlapping flat circles.
  // Built once as a plain function (no boolean ops, no components-with-
  // variants complexity) and reused at several sizes.
  // ---------------------------------------------------------------------
  function buildLogo(size) {
    var f = box('Logo', { w: size, h: size });
    f.layoutMode = 'NONE';
    f.clipsContent = true;
    setFill(f, 'accent');
    f.cornerRadius = size * (RADIUS.badge / 96);
    var dot1 = ellipse(size * 0.46, size * 0.46, 'ground');
    add(f, dot1); place(dot1, size * 0.16, size * 0.14);
    var dot2 = ellipse(size * 0.3, size * 0.3, 'surfaceSage');
    add(f, dot2); place(dot2, size * 0.5, size * 0.52);
    return f;
  }

  // ---------------------------------------------------------------------
  // Components: buttons, chips, status bar, nav bar, header
  // ---------------------------------------------------------------------
  function button(label, variant) {
    var fillToken = variant === 'primary' ? 'accent' : (variant === 'secondary' ? 'surfaceSage' : null);
    var textToken = variant === 'primary' ? 'onAccent' : (variant === 'ghost' ? 'inkMuted' : 'ink');
    var b = box('Button/' + variant, {
      dir: 'HORIZONTAL', gap: 8, pad: { l: 24, r: 24, t: 18, b: 18 },
      primaryAlign: 'CENTER', counterAlign: 'CENTER', fill: fillToken, radius: RADIUS.pill
    });
    add(b, txt(label, 'label', textToken, {}));
    b.name = label + ' Button';
    return b;
  }

  function chip(label, selected) {
    var c = box('Chip/Selectable', {
      dir: 'HORIZONTAL', gap: 8, pad: { l: 16, r: 16, t: 10, b: 10 },
      primaryAlign: 'CENTER', counterAlign: 'CENTER',
      fill: selected ? 'accentTint' : 'surface', radius: RADIUS.pill
    });
    add(c, txt(label, 'label', 'ink', {}));
    c.name = 'Chip: ' + label + (selected ? ' (selected)' : '');
    return c;
  }

  function statusBar() {
    var sb = box('Status Bar', {
      dir: 'HORIZONTAL', pad: { l: 24, r: 24, t: 14, b: 6 },
      primaryAlign: 'SPACE_BETWEEN', counterAlign: 'CENTER',
      primarySizing: 'FIXED', counterSizing: 'FIXED', w: 390, h: 44
    });
    add(sb, txt('9:41', 'caption', 'ink', {}));
    var right = box('Status Icons', { dir: 'HORIZONTAL', gap: 4, counterAlign: 'MAX' });
    [6, 9, 12].forEach(function (h) {
      var b2 = bar(3, h); b2.cornerRadius = 1; setFill(b2, 'ink');
      add(right, b2);
    });
    var batt = rect(20, 10, 'ink', 2);
    add(right, batt);
    add(sb, right);
    return sb;
  }

  var NAV_ITEMS = [
    { key: 'home', label: 'Home', icon: 'home' },
    { key: 'treatment', label: 'Treatment', icon: 'treatment' },
    { key: 'chat', label: 'Chat', icon: 'chat' },
    { key: 'report', label: 'Report', icon: 'report' }
  ];

  function navBar(activeKey) {
    var nb = box('Nav Bar', {
      dir: 'HORIZONTAL', pad: { l: 16, r: 16, t: 12, b: 20 },
      primaryAlign: 'SPACE_BETWEEN', counterAlign: 'CENTER', fill: 'surface',
      primarySizing: 'FIXED', counterSizing: 'FIXED', w: 390, h: 84
    });
    var hotspots = {};
    NAV_ITEMS.forEach(function (it) {
      var active = it.key === activeKey;
      var cell = box('Nav/' + it.key, { dir: 'VERTICAL', gap: 4, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
      add(cell, icon(it.icon, 24, active ? 'accent' : 'inkMuted'));
      add(cell, txt(it.label, 'caption', active ? 'accent' : 'inkMuted', {}));
      add(nb, cell);
      hotspots['nav_' + it.key] = cell;
    });
    return { frame: nb, hotspots: hotspots };
  }

  function header(title, opts) {
    opts = opts || {};
    var h = box('Header', { dir: 'VERTICAL', gap: 12 });
    var row = box('Header Row', { dir: 'HORIZONTAL', gap: 12, counterAlign: 'CENTER' });
    var backNode = null;
    if (opts.back) {
      backNode = box('Back Button', { w: 40, h: 40, radius: RADIUS.pill, fill: 'surface' });
      var bi = icon('back', 20, 'ink');
      add(backNode, bi); place(bi, 10, 10);
      add(row, backNode);
    }
    add(row, txt(title, 'heading', 'ink', {}));
    add(h, row);
    if (opts.progress != null) {
      var wrap = box('Progress', { w: CONTENT_W, h: 8 });
      var track = rect(CONTENT_W, 8, 'surfaceSageTint', 4);
      var fillBar = rect(Math.max(8, CONTENT_W * opts.progress), 8, 'accent', 4);
      add(wrap, track); place(track, 0, 0);
      add(wrap, fillBar); place(fillBar, 0, 0);
      add(h, wrap);
    }
    return { frame: h, back: backNode };
  }

  function screenBase(label, bgToken) {
    var screen = box('Screen: ' + label, {
      dir: 'VERTICAL', primarySizing: 'FIXED', counterSizing: 'FIXED', w: 390, h: 844, fill: bgToken
    });
    add(screen, statusBar());
    return screen;
  }

  function contentCol(opts) {
    opts = opts || {};
    var c = box('Content', {
      dir: 'VERTICAL', gap: opts.gap != null ? opts.gap : SPACE.xl,
      pad: { l: SPACE.xl, r: SPACE.xl, t: opts.padTop != null ? opts.padTop : SPACE.xl, b: SPACE.xl },
      primaryAlign: opts.primaryAlign || 'MIN', counterAlign: opts.counterAlign || 'MIN'
    });
    return c;
  }

  function answerRow(label, selected) {
    var r = box('Answer: ' + label, {
      dir: 'HORIZONTAL', gap: 12, pad: 16, counterAlign: 'CENTER',
      fill: selected ? 'accentTint' : 'surface', radius: RADIUS.md
    });
    var dotWrap = box('Radio', { w: 20, h: 20, radius: RADIUS.pill, fill: selected ? 'accent' : 'surfaceSageTint' });
    if (selected) { var inner = ellipse(8, 8, 'onAccent'); add(dotWrap, inner); place(inner, 6, 6); }
    add(r, dotWrap);
    var label_ = txt(label, 'body', 'ink', {});
    add(r, label_); fillH(label_);
    return r;
  }

  // ---------------------------------------------------------------------
  // Screens
  // ---------------------------------------------------------------------
  function buildSplash() {
    var screen = screenBase('Splash', 'ground');
    var content = contentCol({ gap: SPACE.lg, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    add(screen, content); fillV(content); fillH(content);
    add(content, buildLogo(96));
    add(content, txt('Haven', 'display', 'ink', { align: 'CENTER' }));
    add(content, txt('Gentle support for every day.', 'body', 'inkMuted', { align: 'CENTER' }));
    return { frame: screen, hotspots: { forward: screen } };
  }

  function buildHome() {
    var screen = screenBase('Home', 'ground');
    var content = contentCol({ gap: SPACE.xxl });
    add(screen, content); fillV(content); fillH(content);

    var greet = box('Greeting', { dir: 'VERTICAL', gap: 4 });
    add(greet, txt('Good evening, Alex', 'heading', 'ink', {}));
    add(greet, txt("Here's a little focus for today.", 'body', 'inkMuted', {}));
    add(content, greet); fillH(greet);

    var suggestion = box('Suggestion Card', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'accent', radius: RADIUS.lg });
    add(suggestion, txt("Today's breathing moment", 'heading', 'onAccent', {}));
    add(suggestion, txt('3 minutes · a gentle way to settle in.', 'body', 'onAccent', {}));
    var startBtn = button('Start', 'secondary');
    add(suggestion, startBtn);
    add(content, suggestion); fillH(suggestion);

    add(content, txt('Take care of yourself', 'heading', 'ink', {}));

    var cardsRow = box('Feature Cards', { dir: 'HORIZONTAL', gap: 16 });
    var treatmentCard = box('Card: Treatment', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'surfaceSage', radius: RADIUS.lg });
    add(treatmentCard, icon('treatment', 28, 'ink'));
    add(treatmentCard, txt('Treatment', 'label', 'ink', {}));
    add(treatmentCard, txt('Breathing & sound', 'caption', 'ink', {}));
    add(cardsRow, treatmentCard); fillH(treatmentCard);

    var chatCard = box('Card: Chat', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(chatCard, icon('chat', 28, 'accent'));
    add(chatCard, txt('Chat', 'label', 'ink', {}));
    add(chatCard, txt('Talk it through', 'caption', 'inkMuted', {}));
    add(cardsRow, chatCard); fillH(chatCard);

    add(content, cardsRow); fillH(cardsRow);

    var weekStack = box('Your Week', { dir: 'VERTICAL', gap: 8 });
    add(weekStack, txt('Your week', 'heading', 'ink', {}));
    var dotsRow = box('Mood Dots', { dir: 'HORIZONTAL', gap: 8 });
    for (var i = 0; i < 7; i++) { add(dotsRow, ellipse(14, 14, i < 5 ? 'accent' : 'surfaceSageTint')); }
    add(weekStack, dotsRow);
    var reportLink = txt('View your full report →', 'label', 'accent', {});
    add(weekStack, reportLink);
    add(content, weekStack); fillH(weekStack);

    var nav = navBar('home');
    add(screen, nav.frame);

    return {
      frame: screen,
      hotspots: {
        treatment: treatmentCard, chat: chatCard, report: reportLink,
        nav_treatment: nav.hotspots.nav_treatment, nav_chat: nav.hotspots.nav_chat, nav_report: nav.hotspots.nav_report
      }
    };
  }

  function buildTreatmentHub() {
    var screen = screenBase('Treatment Hub', 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Treatment', { back: true });
    add(content, head.frame); fillH(head.frame);
    add(content, txt('Simple tools to help you feel steadier.', 'body', 'inkMuted', {}));

    var breathingCard = box('Card: Breathing Exercise', { dir: 'HORIZONTAL', gap: 16, pad: 20, fill: 'surface', radius: RADIUS.lg, counterAlign: 'CENTER' });
    add(breathingCard, icon('treatment', 28, 'accent'));
    var bStack = box('Text', { dir: 'VERTICAL', gap: 4 });
    add(bStack, txt('Breathing exercise', 'heading', 'ink', {}));
    add(bStack, txt('3 min · follow the circle', 'caption', 'inkMuted', {}));
    add(breathingCard, bStack); fillH(bStack);
    add(content, breathingCard); fillH(breathingCard);

    var soundCard = box('Card: Sound Relaxation', { dir: 'HORIZONTAL', gap: 16, pad: 20, fill: 'surfaceSage', radius: RADIUS.lg, counterAlign: 'CENTER' });
    add(soundCard, icon('sound', 28, 'ink'));
    var sStack = box('Text', { dir: 'VERTICAL', gap: 4 });
    add(sStack, txt('Sound relaxation', 'heading', 'ink', {}));
    add(sStack, txt('Baroque · Rain · Leaves', 'caption', 'ink', {}));
    add(soundCard, sStack); fillH(sStack);
    add(content, soundCard); fillH(soundCard);

    return { frame: screen, hotspots: { breathing: breathingCard, sound: soundCard, back: head.back } };
  }

  function buildBreathing() {
    var screen = screenBase('Breathing Exercise', 'ground');
    var content = contentCol({ gap: SPACE.xxl, counterAlign: 'CENTER' });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Breathing', { back: true });
    add(content, head.frame); fillH(head.frame);

    var ringGroup = ring(220, 0.7, 'surfaceSageTint', 'accent', 0.1);
    add(content, ringGroup);
    var ringLabel = box('Ring Label', { dir: 'VERTICAL', gap: 2, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    add(ringLabel, txt('Inhale', 'heading', 'ink', { align: 'CENTER' }));
    add(ringLabel, txt('4', 'display', 'accent', { align: 'CENTER' }));
    add(ringGroup, ringLabel);
    place(ringLabel, 110 - ringLabel.width / 2, 110 - ringLabel.height / 2);

    add(content, txt('Breathe in slowly through your nose for 4 seconds.', 'body', 'ink', { align: 'CENTER', w: CONTENT_W }));
    add(content, txt('Cycle 2 of 6', 'caption', 'inkMuted', { align: 'CENTER' }));

    var pauseBtn = button('Pause', 'primary');
    add(content, pauseBtn); fillH(pauseBtn);
    add(content, txt('End session', 'label', 'inkMuted', { align: 'CENTER' }));

    return { frame: screen, hotspots: { back: head.back } };
  }

  function buildSound() {
    var screen = screenBase('Sound Relaxation', 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Sound relaxation', { back: true });
    add(content, head.frame); fillH(head.frame);

    var nowPlaying = box('Now Playing', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'surfaceSage', radius: RADIUS.lg });
    add(nowPlaying, txt('Rain on leaves', 'heading', 'ink', {}));
    add(nowPlaying, txt('32:00 remaining', 'caption', 'ink', {}));
    var wave = box('Waveform', { dir: 'HORIZONTAL', gap: 4, counterAlign: 'MAX' });
    [10, 18, 24, 14, 20, 28, 16, 22, 12, 18, 26, 14].forEach(function (h) {
      var b2 = bar(6, h); b2.cornerRadius = 3; setFill(b2, 'ink'); add(wave, b2);
    });
    add(nowPlaying, wave);
    add(content, nowPlaying); fillH(nowPlaying);

    var transport = box('Transport', { dir: 'HORIZONTAL', gap: 24, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    add(transport, icon('back', 24, 'inkMuted'));
    var playCircle = box('Play Button', { w: 64, h: 64, radius: RADIUS.pill, fill: 'accent' });
    var playIcon = icon('play', 24, 'onAccent'); add(playCircle, playIcon); place(playIcon, 20, 20);
    add(transport, playCircle);
    var nextIcon = icon('back', 24, 'inkMuted'); nextIcon.rotation = 180;
    add(transport, nextIcon);
    add(content, transport); fillH(transport);

    var progressTrack = box('Playback Progress', { w: CONTENT_W, h: 6 });
    var pTrack = rect(CONTENT_W, 6, 'surfaceSageTint', 3);
    var pFill = rect(CONTENT_W * 0.35, 6, 'accent', 3);
    add(progressTrack, pTrack); place(pTrack, 0, 0);
    add(progressTrack, pFill); place(pFill, 0, 0);
    add(content, progressTrack);

    var chipsRow = box('Sound Options', { dir: 'HORIZONTAL', gap: 12 });
    add(chipsRow, chip('Baroque music', true));
    add(chipsRow, chip('Rain sounds', false));
    add(chipsRow, chip('Leaf sounds', false));
    add(content, chipsRow);

    return { frame: screen, hotspots: { back: head.back } };
  }

  function buildChatSelect() {
    var screen = screenBase('Chat Mode Select', 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Chat with Haven', { back: true });
    add(content, head.frame); fillH(head.frame);
    add(content, txt("Choose how you'd like to talk today.", 'body', 'inkMuted', {}));

    function modeCard(title, subtitle, iconName) {
      var c = box('Card: ' + title, { dir: 'HORIZONTAL', gap: 16, pad: 20, fill: 'surface', radius: RADIUS.lg, counterAlign: 'CENTER' });
      add(c, icon(iconName, 28, 'accent'));
      var stack = box('Text', { dir: 'VERTICAL', gap: 4 });
      add(stack, txt(title, 'heading', 'ink', {}));
      add(stack, txt(subtitle, 'caption', 'inkMuted', {}));
      add(c, stack); fillH(stack);
      var chooseBtn = button('Choose', 'secondary');
      add(c, chooseBtn);
      return { card: c, button: chooseBtn };
    }
    var textOpt = modeCard('Text', 'Write at your own pace', 'chat');
    add(content, textOpt.card); fillH(textOpt.card);
    var voiceOpt = modeCard('Voice', 'Talk it out loud', 'mic');
    add(content, voiceOpt.card); fillH(voiceOpt.card);

    add(content, txt('You can always switch later.', 'caption', 'inkMuted', {}));

    return { frame: screen, hotspots: { text: textOpt.button, voice: voiceOpt.button, back: head.back } };
  }

  function buildTextChat() {
    var screen = screenBase('Text Chat', 'ground');
    var content = contentCol({ gap: SPACE.lg });
    add(screen, content); fillV(content); fillH(content);

    var headRow = box('Chat Header', { dir: 'HORIZONTAL', gap: 12, counterAlign: 'CENTER' });
    var backBtn = box('Back Button', { w: 40, h: 40, radius: RADIUS.pill, fill: 'surface' });
    var bi = icon('back', 20, 'ink'); add(backBtn, bi); place(bi, 10, 10);
    add(headRow, backBtn);
    add(headRow, buildLogo(32));
    var headText = box('Header Text', { dir: 'VERTICAL', gap: 0 });
    add(headText, txt('Haven', 'label', 'ink', {}));
    add(headText, txt('Here for you', 'caption', 'inkMuted', {}));
    add(headRow, headText);
    add(content, headRow); fillH(headRow);

    var thread = box('Thread', { dir: 'VERTICAL', gap: 12 });
    function bubble(text, fromUser) {
      var b = box('Bubble', { dir: 'VERTICAL', pad: 16, fill: fromUser ? 'surfaceSage' : 'surface', radius: RADIUS.md });
      add(b, txt(text, 'body', 'ink', { w: CONTENT_W * 0.74 }));
      var wrap = box('Bubble Wrap', { dir: 'HORIZONTAL', primaryAlign: fromUser ? 'MAX' : 'MIN' });
      add(wrap, b);
      return wrap;
    }
    add(thread, bubble('Hi Alex, how are you feeling this evening?', false));
    add(thread, bubble('A bit tired, but I went for my walk today.', true));
    add(thread, bubble("That's wonderful — three days in a row now. Want to tell me more?", false));
    add(content, thread); fillH(thread); fillV(thread);

    var inputBar = box('Input Bar', { dir: 'HORIZONTAL', gap: 12, pad: { l: 16, r: 8, t: 8, b: 8 }, counterAlign: 'CENTER', fill: 'surface', radius: RADIUS.pill });
    var placeholder = txt('Type a message...', 'body', 'inkMuted', {});
    add(inputBar, placeholder); fillH(placeholder);
    var micSmall = box('Mic Button', { w: 40, h: 40, radius: RADIUS.pill, fill: 'surfaceSageTint' });
    var mi = icon('mic', 18, 'ink'); add(micSmall, mi); place(mi, 11, 11);
    add(inputBar, micSmall);
    var sendBtn = box('Send Button', { w: 40, h: 40, radius: RADIUS.pill, fill: 'accent' });
    var si = icon('send', 18, 'onAccent'); add(sendBtn, si); place(si, 11, 11);
    add(inputBar, sendBtn);
    add(content, inputBar); fillH(inputBar);

    return { frame: screen, hotspots: { back: backBtn } };
  }

  function buildVoiceChoice() {
    var screen = screenBase('Voice Chat — Camera Choice', 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Voice chat', { back: true });
    add(content, head.frame); fillH(head.frame);
    add(content, txt("Would you like to turn your camera on? This helps Haven understand how you're feeling, but it's completely optional.", 'body', 'inkMuted', {}));

    var offCard = box('Card: Camera Off', { dir: 'VERTICAL', gap: 8, pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(offCard, txt('Camera off — just talk', 'heading', 'ink', {}));
    add(offCard, txt('A voice-only conversation.', 'caption', 'inkMuted', {}));
    add(content, offCard); fillH(offCard);

    var onCard = box('Card: Camera On', { dir: 'VERTICAL', gap: 8, pad: 20, fill: 'surfaceSage', radius: RADIUS.lg });
    var onHeaderRow = box('On Header', { dir: 'HORIZONTAL', gap: 8, counterAlign: 'CENTER' });
    add(onHeaderRow, txt('Camera on', 'heading', 'ink', {}));
    var badge = box('Badge', { dir: 'HORIZONTAL', pad: { l: 10, r: 10, t: 4, b: 4 }, fill: 'surfaceSageTint', radius: RADIUS.pill });
    add(badge, txt('Optional check-in', 'caption', 'ink', {}));
    add(onHeaderRow, badge);
    add(onCard, onHeaderRow);
    add(onCard, txt('Lets Haven gently check in on how you look and feel.', 'caption', 'ink', {}));
    add(content, onCard); fillH(onCard);

    add(content, txt('You can turn it off anytime during the call.', 'caption', 'inkMuted', {}));

    return { frame: screen, hotspots: { cameraOff: offCard, cameraOn: onCard, back: head.back } };
  }

  function buildConsent() {
    var screen = screenBase('Camera & Data Consent', 'ground');
    var content = contentCol({ gap: SPACE.xl, counterAlign: 'CENTER' });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Before we start', { back: true });
    add(content, head.frame); fillH(head.frame);

    var iconWrap = box('Icon Wrap', { w: 72, h: 72, radius: RADIUS.pill, fill: 'surfaceSageTint' });
    var ci = icon('camera', 32, 'ink'); add(iconWrap, ci); place(ci, 20, 20);
    add(content, iconWrap);

    add(content, txt("Haven can gently analyze your expression during this call to better understand how you're doing. Your recording is processed securely and only used to support your care — never shared without your permission.", 'body', 'ink', { w: CONTENT_W }));

    var checklist = box('Checklist', { dir: 'VERTICAL', gap: 12 });
    ['Processed securely in the cloud', 'Used only to personalize your support', 'You can turn this off anytime in Settings'].forEach(function (line) {
      var row = box('Check Row', { dir: 'HORIZONTAL', gap: 12, counterAlign: 'CENTER' });
      var dotWrap = box('Dot Wrap', { w: 20, h: 20 });
      var dot = ellipse(8, 8, 'accent'); add(dotWrap, dot); place(dot, 6, 6);
      add(row, dotWrap);
      var lineText = txt(line, 'body', 'ink', {});
      add(row, lineText); fillH(lineText);
      add(checklist, row); fillH(row);
    });
    add(content, checklist); fillH(checklist);

    var agreeBtn = button('I agree, continue', 'primary');
    add(content, agreeBtn); fillH(agreeBtn);
    var notNowBtn = button('Not now', 'ghost');
    add(content, notNowBtn); fillH(notNowBtn);

    return { frame: screen, hotspots: { agree: agreeBtn, notNow: notNowBtn, back: head.back } };
  }

  function buildQuestionnaireIntro() {
    var screen = box('Screen: Questionnaire Intro', { w: 390, h: 844, fill: 'ground' });
    var backdrop = rect(390, 844, 'ink', 0);
    backdrop.opacity = 0.45;
    add(screen, backdrop); place(backdrop, 0, 0);

    var modal = box('Modal Card', { dir: 'VERTICAL', gap: 16, pad: 28, fill: 'surface', radius: RADIUS.lg, counterSizing: 'FIXED', w: 342, h: 100 });
    add(modal, txt('Just two quick check-ins', 'heading', 'ink', {}));
    add(modal, txt("Before we begin, a couple of short questionnaires help Haven understand how you've been feeling lately. It takes about 3 minutes.", 'body', 'inkMuted', { w: 342 - 56 }));
    var startBtn = button('Start', 'primary'); add(modal, startBtn); fillH(startBtn);
    var skipBtn = button('Skip for now', 'ghost'); add(modal, skipBtn); fillH(skipBtn);
    try {
      modal.effects = [{ type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.18 }, offset: { x: 0, y: 12 }, radius: 32, spread: 0, visible: true, blendMode: 'NORMAL' }];
    } catch (e) { note('Could not apply modal shadow: ' + e.message); }

    add(screen, modal);
    place(modal, (390 - 342) / 2, (844 - modal.height) / 2);

    return { frame: screen, hotspots: { start: startBtn, skip: skipBtn } };
  }

  function buildQuestionScreen(title, question, options, selectedIndex, progress) {
    var screen = screenBase(title, 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header(title, { progress: progress });
    add(content, head.frame); fillH(head.frame);

    var qCard = box('Question Card', { dir: 'VERTICAL', pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(qCard, txt(question, 'heading', 'ink', { w: CONTENT_W - 40 }));
    add(content, qCard); fillH(qCard);

    var optionsStack = box('Options', { dir: 'VERTICAL', gap: 12 });
    options.forEach(function (opt, idx) {
      var row = answerRow(opt, idx === selectedIndex);
      add(optionsStack, row); fillH(row);
    });
    add(content, optionsStack); fillH(optionsStack);

    var nextBtn = button('Next', 'primary');
    add(content, nextBtn); fillH(nextBtn);

    return { frame: screen, hotspots: { next: nextBtn } };
  }

  function buildPHQ9() {
    return buildQuestionScreen('Check-in 1 of 2',
      'Over the last 2 weeks, how often have you felt little interest or pleasure in doing things?',
      ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'], 1, 0.5);
  }

  function buildBDI2() {
    return buildQuestionScreen('Check-in 2 of 2',
      "Which statement best describes how you've felt this week about your future?",
      ['I feel hopeful about the future', 'I feel a little less hopeful than usual', "I don't expect things to work out for me", 'I feel the future is hopeless'], 1, 0.95);
  }

  function buildFacialRecording() {
    var screen = screenBase('Facial Recording', 'ground');
    var content = contentCol({ gap: SPACE.xl, counterAlign: 'CENTER' });
    add(screen, content); fillV(content); fillH(content);

    var topRow = box('Top Row', { dir: 'HORIZONTAL', primaryAlign: 'SPACE_BETWEEN', counterAlign: 'CENTER' });
    add(topRow, txt('Recording', 'heading', 'ink', {}));
    var cancelLink = txt('Cancel', 'label', 'inkMuted', {});
    add(topRow, cancelLink);
    add(content, topRow); fillH(topRow);

    var preview = box('Camera Preview', { w: CONTENT_W, h: 260, radius: RADIUS.lg, fill: 'surfaceSage', clip: true });
    var face = ellipse(120, 140, 'surfaceSageTint'); add(preview, face); place(face, CONTENT_W / 2 - 60, 40);
    var eyeL = ellipse(10, 10, 'ink'); add(preview, eyeL); place(eyeL, CONTENT_W / 2 - 30, 90);
    var eyeR = ellipse(10, 10, 'ink'); add(preview, eyeR); place(eyeR, CONTENT_W / 2 + 18, 90);
    var mouth = rect(36, 8, 'ink', 4); add(preview, mouth); place(mouth, CONTENT_W / 2 - 18, 130);
    add(content, preview);

    var ringGroup = ring(160, 0.6, 'surfaceSageTint', 'accent', 0.1);
    add(content, ringGroup);
    var ringLabel = box('Ring Label', { dir: 'VERTICAL', gap: 0, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    add(ringLabel, txt('18', 'display', 'accent', { align: 'CENTER' }));
    add(ringLabel, txt('seconds left', 'caption', 'inkMuted', { align: 'CENTER' }));
    add(ringGroup, ringLabel);
    place(ringLabel, 80 - ringLabel.width / 2, 80 - ringLabel.height / 2);

    add(content, txt('Look at the camera and relax — this will only take a moment.', 'body', 'inkMuted', { align: 'CENTER', w: CONTENT_W }));

    return { frame: screen, hotspots: { cancel: cancelLink, done: screen } };
  }

  function buildRecordingComplete() {
    var screen = screenBase('Recording Complete', 'ground');
    var content = contentCol({ gap: SPACE.lg, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    add(screen, content); fillV(content); fillH(content);

    var badge = box('Success Badge', { w: 88, h: 88, radius: RADIUS.pill, fill: 'accent' });
    var ck = icon('check', 36, 'onAccent'); add(badge, ck); place(ck, 26, 26);
    add(content, badge);

    add(content, txt('All done!', 'display', 'ink', { align: 'CENTER' }));
    add(content, txt("Thank you — that wasn't so bad. Let's continue to your chat.", 'body', 'inkMuted', { align: 'CENTER', w: CONTENT_W }));

    var continueBtn = button('Continue', 'primary');
    add(content, continueBtn); fillH(continueBtn);

    return { frame: screen, hotspots: { continue: continueBtn } };
  }

  function buildVideoChat() {
    var screen = screenBase('Video Chat', 'ground');
    var content = contentCol({ gap: SPACE.lg });
    add(screen, content); fillV(content); fillH(content);

    var topRow = box('Call Header', { dir: 'HORIZONTAL', primaryAlign: 'SPACE_BETWEEN', counterAlign: 'CENTER' });
    add(topRow, txt('Live with Haven', 'label', 'ink', {}));
    add(topRow, txt('04:12', 'caption', 'inkMuted', {}));
    add(content, topRow); fillH(topRow);

    var videoArea = box('Camera Preview', { w: CONTENT_W, h: 420, radius: RADIUS.lg, fill: 'surfaceSage', clip: true });
    var face2 = ellipse(140, 160, 'surfaceSageTint'); add(videoArea, face2); place(face2, CONTENT_W / 2 - 70, 140);
    var eyeL2 = ellipse(12, 12, 'ink'); add(videoArea, eyeL2); place(eyeL2, CONTENT_W / 2 - 36, 200);
    var eyeR2 = ellipse(12, 12, 'ink'); add(videoArea, eyeR2); place(eyeR2, CONTENT_W / 2 + 22, 200);
    var mouth2 = rect(44, 10, 'ink', 5); add(videoArea, mouth2); place(mouth2, CONTENT_W / 2 - 22, 250);
    var presence = buildLogo(40);
    add(videoArea, presence); place(presence, 16, 16);
    var reportLinkWrap = box('Report Link Wrap', { dir: 'HORIZONTAL', pad: { l: 12, r: 12, t: 8, b: 8 }, fill: 'accent', radius: RADIUS.pill });
    add(reportLinkWrap, txt('View my report', 'label', 'onAccent', {}));
    add(videoArea, reportLinkWrap); place(reportLinkWrap, CONTENT_W - reportLinkWrap.width - 16, 16);
    add(content, videoArea);

    var controls = box('Controls', { dir: 'HORIZONTAL', gap: 20, primaryAlign: 'CENTER', counterAlign: 'CENTER' });
    function ctrlBtn(iconName, bgToken, fgToken) {
      var c = box('Control', { w: 56, h: 56, radius: RADIUS.pill, fill: bgToken });
      var ic = icon(iconName, 22, fgToken); add(c, ic); place(ic, 17, 17);
      return c;
    }
    add(controls, ctrlBtn('mic', 'surfaceSage', 'ink'));
    add(controls, ctrlBtn('camera', 'surfaceSage', 'ink'));
    var endBtn = ctrlBtn('end-call', 'accent', 'onAccent');
    add(controls, endBtn);
    add(content, controls); fillH(controls);

    return { frame: screen, hotspots: { viewReport: reportLinkWrap, end: endBtn } };
  }

  function buildReportAnalysis() {
    var screen = screenBase('Report Analysis', 'ground');
    var content = contentCol({ gap: SPACE.xl });
    add(screen, content); fillV(content); fillH(content);
    var head = header('Your report', { back: true });
    add(content, head.frame); fillH(head.frame);
    add(content, txt("A gentle look at how you've been doing.", 'body', 'inkMuted', {}));

    var summary = box('Summary Card', { dir: 'VERTICAL', gap: 16, pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(summary, txt('This week', 'heading', 'ink', {}));
    var tilesRow = box('Stat Tiles', { dir: 'HORIZONTAL', gap: 12 });
    function tile(label, value, highlight) {
      var t = box('Tile', { dir: 'VERTICAL', gap: 4, pad: 12, fill: highlight ? 'accentTint' : 'surfaceSageTint', radius: RADIUS.md });
      add(t, txt(value, 'heading', highlight ? 'accent' : 'ink', {}));
      add(t, txt(label, 'caption', 'inkMuted', {}));
      return t;
    }
    var t1 = tile('Mood trend', 'Improving', true);
    var t2 = tile('Check-ins', '5 of 7 days', false);
    var t3 = tile('Streak', '3 days', false);
    add(tilesRow, t1); fillH(t1); add(tilesRow, t2); fillH(t2); add(tilesRow, t3); fillH(t3);
    add(summary, tilesRow); fillH(tilesRow);
    add(content, summary); fillH(summary);

    var chartCard = box('Trend Chart', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(chartCard, txt('6-week trend', 'heading', 'ink', {}));
    var chartW = CONTENT_W - 40;
    var chartArea = box('Chart Area', { w: chartW, h: 140 });
    var values = [0.3, 0.4, 0.35, 0.55, 0.5, 0.75]; // placeholder data, rising trend
    var stepX = chartW / (values.length - 1);
    for (var ci2 = 0; ci2 < values.length - 1; ci2++) {
      var x1 = ci2 * stepX, y1 = 140 - values[ci2] * 140, x2 = (ci2 + 1) * stepX, y2 = 140 - values[ci2 + 1] * 140;
      var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy), ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var seg = bar(Math.max(len, 1), 3); seg.cornerRadius = 1.5; setFill(seg, ci2 === values.length - 2 ? 'accent' : 'ink');
      add(chartArea, seg); place(seg, x1, y1 - 1.5); seg.rotation = ang;
    }
    values.forEach(function (v, idx) {
      var dot = ellipse(10, 10, idx === values.length - 1 ? 'accent' : 'ink');
      add(chartArea, dot); place(dot, idx * stepX - 5, 140 - v * 140 - 5);
    });
    add(chartCard, chartArea);
    add(chartCard, txt('Placeholder data for illustration.', 'caption', 'inkMuted', {}));
    add(content, chartCard); fillH(chartCard);

    var notable = box('Notable Changes', { dir: 'VERTICAL', gap: 12, pad: 20, fill: 'surfaceSage', radius: RADIUS.lg });
    add(notable, txt('Notable changes', 'heading', 'ink', {}));
    ['Smiling more often in evening check-ins', 'Slightly more tension noticed on Tuesdays'].forEach(function (line) {
      var row = box('Note Row', { dir: 'HORIZONTAL', gap: 10, counterAlign: 'CENTER' });
      var dotWrap = box('Dot Wrap', { w: 16, h: 16 });
      var dot = ellipse(6, 6, 'ink'); add(dotWrap, dot); place(dot, 5, 5);
      add(row, dotWrap);
      var lineText = txt(line, 'body', 'ink', {});
      add(row, lineText); fillH(lineText);
      add(notable, row); fillH(row);
    });
    add(content, notable); fillH(notable);

    add(content, txt('Based on your recent check-ins. This is a general trend, not a diagnosis.', 'caption', 'inkMuted', { w: CONTENT_W }));

    return { frame: screen, hotspots: { back: head.back } };
  }

  // ---------------------------------------------------------------------
  // Layout, flow wiring, orchestration
  // ---------------------------------------------------------------------
  var SCREEN_BUILDERS = [
    ['splash', buildSplash], ['home', buildHome], ['treatmentHub', buildTreatmentHub],
    ['breathing', buildBreathing], ['sound', buildSound], ['chatSelect', buildChatSelect],
    ['textChat', buildTextChat], ['voiceChoice', buildVoiceChoice], ['consent', buildConsent],
    ['questionnaireIntro', buildQuestionnaireIntro], ['phq9', buildPHQ9], ['bdi2', buildBDI2],
    ['facialRecording', buildFacialRecording], ['recordingComplete', buildRecordingComplete],
    ['videoChat', buildVideoChat], ['reportAnalysis', buildReportAnalysis]
  ];

  var SCREEN_LABELS = {
    splash: '1. Splash', home: '2. Home', treatmentHub: '3. Treatment Hub',
    breathing: '4. Breathing Exercise', sound: '5. Sound Relaxation', chatSelect: '6. Chat Mode Select',
    textChat: '7. Text Chat', voiceChoice: '8. Voice Chat — Camera Choice', consent: '9. Camera & Data Consent',
    questionnaireIntro: '10. Questionnaire Intro', phq9: '11. PHQ-9 Questionnaire', bdi2: '12. BDI-II Questionnaire',
    facialRecording: '13. Facial Recording (30s)', recordingComplete: '14. Recording Complete',
    videoChat: '15. Video Chat', reportAnalysis: '16. Report Analysis'
  };

  // [fromKey, hotspotName, toKey] — every edge is wired as a real click-to-navigate
  // prototype reaction, and also drawn as a visible connector arrow.
  var EDGES = [
    ['splash', 'forward', 'home'],
    ['home', 'treatment', 'treatmentHub'], ['home', 'chat', 'chatSelect'], ['home', 'report', 'reportAnalysis'],
    ['home', 'nav_treatment', 'treatmentHub'], ['home', 'nav_chat', 'chatSelect'], ['home', 'nav_report', 'reportAnalysis'],
    ['treatmentHub', 'breathing', 'breathing'], ['treatmentHub', 'sound', 'sound'], ['treatmentHub', 'back', 'home'],
    ['breathing', 'back', 'treatmentHub'], ['sound', 'back', 'treatmentHub'],
    ['chatSelect', 'text', 'textChat'], ['chatSelect', 'voice', 'voiceChoice'], ['chatSelect', 'back', 'home'],
    ['textChat', 'back', 'home'],
    ['voiceChoice', 'cameraOff', 'videoChat'], ['voiceChoice', 'cameraOn', 'consent'], ['voiceChoice', 'back', 'chatSelect'],
    ['consent', 'agree', 'questionnaireIntro'], ['consent', 'notNow', 'voiceChoice'], ['consent', 'back', 'voiceChoice'],
    ['questionnaireIntro', 'start', 'phq9'], ['questionnaireIntro', 'skip', 'videoChat'],
    ['phq9', 'next', 'bdi2'], ['bdi2', 'next', 'facialRecording'],
    ['facialRecording', 'cancel', 'voiceChoice'], ['facialRecording', 'done', 'recordingComplete'],
    ['recordingComplete', 'continue', 'videoChat'],
    ['videoChat', 'viewReport', 'reportAnalysis'], ['videoChat', 'end', 'home'],
    ['reportAnalysis', 'back', 'home']
  ];

  function drawConnectors(screens, rowY) {
    var laneBase = rowY + 844 + 48;
    var laneIndex = 0;
    var drawn = 0;
    EDGES.forEach(function (e) {
      var from = screens[e[0]], to = screens[e[2]];
      if (!from || !to) return;
      try {
        var x1 = from.frame.x + from.frame.width / 2;
        var y1 = from.frame.y + from.frame.height;
        var x2 = to.frame.x + to.frame.width / 2;
        var y2 = to.frame.y + to.frame.height;
        var laneY = laneBase + (laneIndex % 6) * 22;
        laneIndex++;
        var minX = Math.min(x1, x2, x2), maxX = Math.max(x1, x2);
        var minY = Math.min(y1, y2, laneY), maxY = Math.max(y1, y2, laneY) + 8;
        var vec = figma.createVector();
        vec.name = 'Connector: ' + e[0] + ' -> ' + e[2];
        vec.fills = [];
        vec.strokes = [solidPaint('inkMuted')];
        vec.strokeWeight = 2;
        try { vec.strokeEndCap = 'ARROW_LINES'; vec.strokeStartCap = 'NONE'; }
        catch (capErr1) {
          try { vec.strokeCap = 'ARROW_LINES'; }
          catch (capErr2) { note('Arrowheads not supported on this Figma build for ' + e[0] + ' -> ' + e[2] + '; drawn as a plain line.'); }
        }
        vec.resize(Math.max(maxX - minX, 1), Math.max(maxY - minY, 1));
        vec.x = minX; vec.y = minY;
        var lx1 = x1 - minX, ly1 = y1 - minY, lx2 = x2 - minX, ly2 = y2 - minY, lly = laneY - minY;
        vec.vectorPaths = [{ windingRule: 'NONZERO', data: 'M ' + lx1 + ' ' + ly1 + ' L ' + lx1 + ' ' + lly + ' L ' + lx2 + ' ' + lly + ' L ' + lx2 + ' ' + ly2 }];
        drawn++;
      } catch (err) {
        note('Could not draw connector ' + e[0] + ' -> ' + e[2] + ': ' + err.message);
      }
    });
    return drawn;
  }

  async function wireReactions(screens) {
    var wired = 0, failed = 0;
    for (var i = 0; i < EDGES.length; i++) {
      var e = EDGES[i];
      var from = screens[e[0]], to = screens[e[2]];
      if (!from || !to) { failed++; continue; }
      var hotspot = (from.hotspots && from.hotspots[e[1]]) || from.frame;
      try {
        if (typeof hotspot.setReactionsAsync === 'function') {
          await hotspot.setReactionsAsync([{
            trigger: { type: 'ON_CLICK' },
            action: { type: 'NODE', destinationId: to.frame.id, navigation: 'NAVIGATE', transition: null, preserveScrollPosition: false }
          }]);
          wired++;
        } else {
          note('setReactionsAsync is not available on this Figma build — interactive prototype links were skipped (connector arrows are still drawn).');
          failed++;
        }
      } catch (err) {
        note('Could not wire reaction ' + e[0] + ' -> ' + e[2] + ': ' + err.message);
        failed++;
      }
    }
    return { wired: wired, failed: failed };
  }

  function removeExistingPage() {
    figma.root.children.filter(function (p) { return p.name === PAGE_NAME; }).forEach(function (p) {
      try { p.remove(); } catch (e) { note('Could not remove previous "' + PAGE_NAME + '" page: ' + e.message); }
    });
  }

  async function main() {
    removeExistingPage();
    var page;
    try {
      page = figma.createPage();
      page.name = PAGE_NAME;
    } catch (e) {
      figma.closePlugin('Could not create a new page — ' + e.message + ' (check your Figma plan\'s page limit).');
      return;
    }
    figma.currentPage = page;

    var available = await figma.listAvailableFontsAsync();
    var resolved = resolveFonts(available);
    FONT.regular = resolved.regular; FONT.medium = resolved.medium;
    FONT.semibold = resolved.semibold; FONT.bold = resolved.bold;
    note('Using font family: ' + resolved.familyUsed + ' (fallback chain: Nunito, Quicksand, Poppins, Inter).');
    await loadAllFonts();
    buildStyles();

    var title = box('Title Section', { dir: 'HORIZONTAL', gap: 24, pad: 32, fill: 'surface', radius: RADIUS.lg, counterAlign: 'CENTER' });
    add(title, buildLogo(72));
    var titleText = box('Title Text', { dir: 'VERTICAL', gap: 4 });
    add(titleText, txt('Haven', 'display', 'ink', {}));
    add(titleText, txt('Gentle support for every day.', 'body', 'inkMuted', {}));
    add(title, titleText);
    place(title, 0, 0);

    var rowY = title.height + 64;

    var screens = {};
    var built = 0, screenFailed = 0;
    SCREEN_BUILDERS.forEach(function (pair) {
      try {
        screens[pair[0]] = pair[1]();
        built++;
      } catch (err) {
        note('Screen "' + pair[0] + '" failed to build: ' + err.message);
        screenFailed++;
      }
    });

    var x = 0, gapX = 80;
    SCREEN_BUILDERS.forEach(function (pair) {
      var s = screens[pair[0]];
      if (!s) return;
      place(s.frame, x, rowY);
      place(txt(SCREEN_LABELS[pair[0]] || pair[0], 'label', 'ink', {}), x, rowY - 32);
      x += s.frame.width + gapX;
    });

    var drawn = drawConnectors(screens, rowY);
    var wireResult = await wireReactions(screens);

    var notesText = notes.length ? notes.join('\n') : 'No issues — build completed cleanly.';
    var notesCard = box('Build Notes', { dir: 'VERTICAL', gap: 8, pad: 20, fill: 'surface', radius: RADIUS.lg });
    add(notesCard, txt('Build notes', 'heading', 'ink', {}));
    add(notesCard, txt(notesText, 'caption', 'inkMuted', { w: 500 }));
    place(notesCard, title.width + 32, 0);

    try { figma.viewport.scrollAndZoomIntoView(page.children); } catch (e) { /* non-critical */ }

    var issueCount = screenFailed + wireResult.failed;
    var summary = built + ' screens built, ' + drawn + ' connectors drawn, ' + wireResult.wired + ' interactive links wired' +
      (issueCount ? (' — ' + issueCount + ' issue(s), see Build notes.') : '.');
    figma.closePlugin(summary);
  }

  main().catch(function (err) {
    try { figma.closePlugin('Haven build failed: ' + err.message); } catch (e) { /* plugin already closing */ }
  });
})();
