// CappyCad — tłumaczenie interfejsu (polski ↔ angielski)
// Teksty źródłowe są po polsku; słownik EN tłumaczy je dokładnie lub wzorcem.
import { EN, EN_PATTERNS } from './i18n-en.js';

export let lang = 'pl';
const origText = new WeakMap(); // węzeł tekstowy -> oryginał
const origAttr = new WeakMap(); // element -> { atrybut: oryginał }
const ATTRS = ['title', 'placeholder', 'aria-label'];

export function tr(s) {
  if (lang === 'pl' || s == null) return s;
  const str = String(s);
  const key = str.trim();
  if (!key) return str;
  if (EN[key] !== undefined) return str.replace(key, EN[key]);
  for (const [re, rep] of EN_PATTERNS) {
    if (re.test(key)) return str.replace(key, key.replace(re, rep));
  }
  return str;
}

function skip(node) {
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !el || !!el.closest('[data-notr], script, style, textarea');
}

function translateText(node) {
  if (skip(node)) return;
  const cur = node.nodeValue;
  if (lang === 'pl') {
    if (origText.has(node)) {
      const o = origText.get(node);
      origText.delete(node);
      if (cur !== o) node.nodeValue = o;
    }
    return;
  }
  const base = origText.has(node) && tr(origText.get(node)) === cur ? origText.get(node) : cur;
  const out = tr(base);
  if (out !== base) {
    origText.set(node, base);
    if (cur !== out) node.nodeValue = out;
  }
}
function translateAttrs(el) {
  if (skip(el)) return;
  let o = origAttr.get(el);
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    if (lang === 'pl') {
      if (o && o[a] !== undefined) {
        if (cur !== o[a]) el.setAttribute(a, o[a]);
        delete o[a];
      }
      continue;
    }
    const base = o && o[a] !== undefined && tr(o[a]) === cur ? o[a] : cur;
    const out = tr(base);
    if (out !== base) {
      if (!o) {
        o = {};
        origAttr.set(el, o);
      }
      o[a] = base;
      if (cur !== out) el.setAttribute(a, out);
    }
  }
}
export function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) {
    translateText(root);
    return;
  }
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n;
  while ((n = w.nextNode())) {
    if (n.nodeType === 3) translateText(n);
    else translateAttrs(n);
  }
}

let observer = null;
export function startObserver() {
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') translateText(m.target);
      else if (m.type === 'attributes') translateAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
  });
}

export function setLang(l) {
  lang = l === 'en' ? 'en' : 'pl';
  document.documentElement.lang = lang;
  translateTree(document.body);
}
export function initialLang() {
  try {
    const s = localStorage.getItem('cappycad-lang');
    if (s) return s;
  } catch {}
  return (navigator.language || 'pl').toLowerCase().startsWith('pl') ? 'pl' : 'en';
}
