// Minimal mock of the Figma Plugin API surface used by ../code.js.
// Runs code.js under plain Node to catch real bugs (typos, wrong argument
// shapes, bad auto-layout assumptions) before ever opening Figma desktop.
// It does NOT prove visual correctness — only that the build completes
// and produces the expected shape (16 screens, connectors, wired links).

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let nextId = 1;
const newId = () => 'n' + (nextId++);

// Deliberately only Inter is "installed" — this exercises the font
// fallback chain (Nunito/Quicksand/Poppins -> Inter) rather than the
// happy path where the first choice is available.
const AVAILABLE_FONTS = [
  { family: 'Inter', style: 'Regular' },
  { family: 'Inter', style: 'Medium' },
  { family: 'Inter', style: 'SemiBold' },
  { family: 'Inter', style: 'Bold' }
];

function approxTextSize(node) {
  const len = (node.characters || '').length;
  const charW = (node.fontSize || 12) * 0.55;
  const lh = (node.lineHeight && node.lineHeight.value) || (node.fontSize || 12) * 1.3;
  if (node.textAutoResize === 'HEIGHT') {
    const w = node._w || 100;
    const lines = Math.max(1, Math.ceil((len * charW) / w));
    node._h = lines * lh;
  } else {
    node._w = Math.max(1, len * charW);
    node._h = lh;
  }
}

function recompute(node) {
  if (!node) return;
  if (node.type === 'TEXT') {
    approxTextSize(node);
  } else if (node.layoutMode === 'VERTICAL' || node.layoutMode === 'HORIZONTAL') {
    const pl = node.paddingLeft || 0, pr = node.paddingRight || 0, pt = node.paddingTop || 0, pb = node.paddingBottom || 0;
    const gap = node.itemSpacing || 0;
    let main = 0, cross = 0;
    node.children.forEach((c) => {
      const cw = c._w || 0, ch = c._h || 0;
      if (node.layoutMode === 'VERTICAL') { main += ch; cross = Math.max(cross, cw); }
      else { main += cw; cross = Math.max(cross, ch); }
    });
    if (node.children.length > 1) main += gap * (node.children.length - 1);
    if (node.layoutMode === 'VERTICAL') {
      if (node.primaryAxisSizingMode === 'AUTO') node._h = main + pt + pb;
      if (node.counterAxisSizingMode === 'AUTO') node._w = cross + pl + pr;
    } else {
      if (node.primaryAxisSizingMode === 'AUTO') node._w = main + pl + pr;
      if (node.counterAxisSizingMode === 'AUTO') node._h = cross + pt + pb;
    }
  }
  if (node.parent) recompute(node.parent);
}

function makeNode(type) {
  const node = {
    id: newId(), type: type, name: type, children: [], parent: null,
    x: 0, y: 0, rotation: 0, opacity: 1, fills: [], strokes: [], strokeWeight: 1,
    cornerRadius: 0, clipsContent: false,
    layoutMode: 'NONE', itemSpacing: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
    primaryAxisSizingMode: 'AUTO', counterAxisSizingMode: 'AUTO',
    primaryAxisAlignItems: 'MIN', counterAxisAlignItems: 'MIN',
    fontName: null, fontSize: 12, lineHeight: { value: 16, unit: 'PIXELS' },
    characters: '', textAlignHorizontal: 'LEFT', textAutoResize: 'WIDTH_AND_HEIGHT',
    pointCount: 3, vectorPaths: null, arcData: null, effects: [],
    _w: 0, _h: 0
  };
  Object.defineProperty(node, 'width', { get() { return this._w; }, configurable: true });
  Object.defineProperty(node, 'height', { get() { return this._h; }, configurable: true });
  Object.defineProperty(node, 'layoutSizingHorizontal', {
    get() { return this._sizingH; },
    set(v) {
      if (v === 'FILL' && !(this.parent && (this.parent.layoutMode === 'HORIZONTAL' || this.parent.layoutMode === 'VERTICAL'))) {
        throw new Error('FILL is only valid on a child of an auto-layout parent');
      }
      if (v === 'HUG' && !(this.layoutMode === 'HORIZONTAL' || this.layoutMode === 'VERTICAL' || this.type === 'TEXT')) {
        throw new Error('HUG is only valid on an auto-layout frame or a text node');
      }
      this._sizingH = v;
    },
    configurable: true
  });
  Object.defineProperty(node, 'layoutSizingVertical', {
    get() { return this._sizingV; },
    set(v) {
      if (v === 'FILL' && !(this.parent && (this.parent.layoutMode === 'HORIZONTAL' || this.parent.layoutMode === 'VERTICAL'))) {
        throw new Error('FILL is only valid on a child of an auto-layout parent');
      }
      if (v === 'HUG' && !(this.layoutMode === 'HORIZONTAL' || this.layoutMode === 'VERTICAL' || this.type === 'TEXT')) {
        throw new Error('HUG is only valid on an auto-layout frame or a text node');
      }
      this._sizingV = v;
    },
    configurable: true
  });
  Object.defineProperty(node, 'fillStyleId', { value: undefined, writable: true, configurable: true });
  Object.defineProperty(node, 'textStyleId', { value: undefined, writable: true, configurable: true });
  node.appendChild = function (child) {
    if (child.parent) {
      const arr = child.parent.children;
      const idx = arr.indexOf(child);
      if (idx >= 0) arr.splice(idx, 1);
    }
    this.children.push(child);
    child.parent = this;
    recompute(child);
  };
  node.resize = function (w, h) {
    this._w = w; this._h = h;
    if (this.type === 'TEXT') approxTextSize(this);
    if (this.parent) recompute(this.parent);
  };
  node.remove = function () {
    if (this.parent) {
      const arr = this.parent.children;
      const idx = arr.indexOf(this);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };
  node.setReactionsAsync = function (reactions) { this._reactions = reactions; return Promise.resolve(); };
  return node;
}

function buildFigmaMock() {
  const root = { children: [] };
  const state = { currentPage: null, notifications: [], closedMessage: null };

  function appendToCurrentPage(node) {
    if (state.currentPage) { state.currentPage.children.push(node); node.parent = state.currentPage; }
    return node;
  }

  const figma = {
    get root() { return root; },
    get currentPage() { return state.currentPage; },
    set currentPage(p) { state.currentPage = p; },
    createPage() {
      const p = { id: newId(), type: 'PAGE', name: '', children: [] };
      p.remove = function () {
        const idx = root.children.indexOf(p);
        if (idx >= 0) root.children.splice(idx, 1);
      };
      root.children.push(p);
      return p;
    },
    createFrame() { return appendToCurrentPage(makeNode('FRAME')); },
    createText() { return appendToCurrentPage(makeNode('TEXT')); },
    createRectangle() { return appendToCurrentPage(makeNode('RECTANGLE')); },
    createEllipse() { return appendToCurrentPage(makeNode('ELLIPSE')); },
    createVector() { return appendToCurrentPage(makeNode('VECTOR')); },
    createPolygon() { return appendToCurrentPage(makeNode('REGULAR_POLYGON')); },
    createPaintStyle() { return { id: newId(), name: '', paints: [] }; },
    createTextStyle() { return { id: newId(), name: '', fontName: null, fontSize: 0, lineHeight: null }; },
    listAvailableFontsAsync() { return Promise.resolve(AVAILABLE_FONTS.map((f) => ({ fontName: f }))); },
    loadFontAsync(f) {
      const ok = AVAILABLE_FONTS.some((x) => x.family === f.family && x.style === f.style);
      return ok ? Promise.resolve() : Promise.reject(new Error('font not available: ' + f.family + ' ' + f.style));
    },
    notify(msg) { state.notifications.push(msg); },
    closePlugin(msg) { state.closedMessage = msg; },
    viewport: { scrollAndZoomIntoView() {} }
  };

  return { figma, state, root };
}

async function run() {
  const codePath = path.join(__dirname, '..', 'code.js');
  const src = fs.readFileSync(codePath, 'utf8');
  const { figma, state, root } = buildFigmaMock();
  const sandbox = { figma, console };
  vm.createContext(sandbox);

  // Run twice against the same mock document to verify the plugin is
  // idempotent (re-running must not leave a duplicate page behind).
  vm.runInContext(src, sandbox, { filename: 'code.js (run 1)' });
  for (let i = 0; i < 20 && state.closedMessage === null; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  state.closedMessage = null;
  vm.runInContext(src, sandbox, { filename: 'code.js (run 2)' });
  for (let i = 0; i < 20 && state.closedMessage === null; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }

  console.log('--- closePlugin message ---');
  console.log(state.closedMessage);

  const pages = root.children.filter((p) => p.name === 'App Presentation');
  const page = pages[pages.length - 1];
  const screenFrames = page ? page.children.filter((n) => n.name && n.name.indexOf('Screen:') === 0) : [];

  console.log('--- summary ---');
  console.log('pages named "App Presentation":', pages.length, '(idempotent rebuild should leave exactly 1)');
  console.log('screen frames found on page:', screenFrames.length, '(expected 16)');

  let ok = true;
  if (!state.closedMessage) { console.error('FAIL: plugin never called figma.closePlugin — main() likely threw or hung.'); ok = false; }
  if (pages.length !== 1) { console.error('FAIL: expected exactly 1 "App Presentation" page, found ' + pages.length); ok = false; }
  if (screenFrames.length !== 16) { console.error('FAIL: expected 16 screen frames, found ' + screenFrames.length); ok = false; }
  if (state.closedMessage && /issue\(s\)/.test(state.closedMessage)) { console.error('FAIL: closePlugin summary reports issues: ' + state.closedMessage); ok = false; }

  if (ok) console.log('PASS');
  process.exit(ok ? 0 : 1);
}

run().catch((err) => {
  console.error('Mock run crashed:', err.stack || err.message);
  process.exit(1);
});
