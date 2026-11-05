// Markdown Planner Utils — features are opted into with link-style tags in the source:
//   [Name](Counter): 3                     → +/- counter
//   - [Name](SequentialTickBoxes)          → the checkboxes below it are a rating scale
//   - [ ] [Name](SyncHeader)               → status header (emoji ✅ ⏳ ⬜)
//     - [ ] [Name](SyncSubheader)          → its "in progress" sub-item
// The preview renders the tags as plain text; preview.js makes checkboxes clickable.
const vscode = require('vscode');

const EXT_ID = 'local.markdown-planner-utils';

function cfg() { return vscode.workspace.getConfiguration('plannerUtils'); }

// Regex source for "](Tag)" — tag names are case-insensitive.
const tag = (name) => `\\]\\(\\s*${name}\\s*\\)`;

/* ============================== Checkboxes ============================== */

const BOX_RE = /^(\s*)- \[( |x|X)\]/;
const SEQ_RE = new RegExp(`^(\\s*)- .*${tag('SequentialTickBoxes')}`, 'i');
const HEADER_RE = new RegExp(`^(\\s*)- \\[( |x|X)\\] (.*${tag('SyncHeader')}.*?)\\s*$`, 'i');
const SUB_RE = new RegExp(`^(\\s*)- \\[( |x|X)\\] .*${tag('SyncSubheader')}`, 'i');
const EMOJI_RE = /\s*(✅|⏳|⬜)$/;
const DONE = '✅', IN_PROGRESS = '⏳', NOT_STARTED = '⬜';

const indentOf = (s) => /^\s*/.exec(s)[0].length;
const setMark = (lines, i, c) => {
  const col = indentOf(lines[i]) + 3;
  lines[i] = lines[i].slice(0, col) + c + lines[i].slice(col + 1);
};

// Rating scale: the run of sibling checkboxes directly under a
// [Name](SequentialTickBoxes) bullet. Checking one checks every box above it;
// unchecking one unchecks every box below it.
function cascadeScale(lines, lineNo, mark) {
  const indent = indentOf(lines[lineNo]);
  const isSibling = i => BOX_RE.test(lines[i] || '') && indentOf(lines[i]) === indent;
  let start = lineNo, end = lineNo;
  while (start > 0 && isSibling(start - 1)) start--;
  while (end < lines.length - 1 && isSibling(end + 1)) end++;

  const parent = SEQ_RE.exec(lines[start - 1] || '');
  if (!parent || parent[1].length >= indent) return;

  if (mark === 'x') for (let i = start; i < lineNo; i++) setMark(lines, i, 'x');
  else for (let i = lineNo + 1; i <= end; i++) setMark(lines, i, ' ');
}

// Every [Name](SyncHeader) item: ticking it ticks its [..](SyncSubheader)
// children; its trailing emoji reflects done / in progress / not started.
function syncHeaders(lines) {
  for (let i = 0; i < lines.length; i++) {
    const h = HEADER_RE.exec(lines[i]);
    if (!h) continue;
    const indent = h[1].length;
    const subs = [];
    for (let j = i + 1; j < lines.length && lines[j].trim() && indentOf(lines[j]) > indent; j++) {
      if (SUB_RE.test(lines[j])) subs.push(j);
    }
    const done = h[2] !== ' ';
    if (done) subs.forEach(j => setMark(lines, j, 'x'));
    const inProgress = subs.some(j => SUB_RE.exec(lines[j])[2] !== ' ');
    const emoji = done ? DONE : inProgress ? IN_PROGRESS : NOT_STARTED;
    lines[i] = `${h[1]}- [${h[2]}] ${h[3].replace(EMOJI_RE, '')} ${emoji}`;
  }
}

// Works on an array of line strings; returns the updated array.
function toggleAndSync(lines, lineNo) {
  const m = BOX_RE.exec(lines[lineNo] || '');
  if (!m) return lines;
  const mark = m[2] === ' ' ? 'x' : ' ';
  setMark(lines, lineNo, mark);
  cascadeScale(lines, lineNo, mark);
  syncHeaders(lines);
  return lines;
}

async function toggle(uri) {
  const q = new URLSearchParams(uri.query);
  const file = q.get('file'), lineNo = Number(q.get('line'));
  if (!file || !Number.isInteger(lineNo)) return;

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(file));
  const wasDirty = doc.isDirty;
  const before = [];
  for (let i = 0; i < doc.lineCount; i++) before.push(doc.lineAt(i).text);
  const after = toggleAndSync(before.slice(), lineNo);

  const we = new vscode.WorkspaceEdit();
  after.forEach((text, i) => {
    if (text !== before[i]) we.replace(doc.uri, doc.lineAt(i).range, text);
  });
  if (we.size === 0) return;
  await vscode.workspace.applyEdit(we);
  if (!wasDirty) await doc.save();
}

/* ======================= Preview rendering (markdown-it) ======================= */

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "[Name](Tag)", optionally followed by ": <number>" (used by Counter).
const INLINE_TAG = /^\[([^\[\]\n]+)\]\(\s*(Counter|SequentialTickBoxes|SyncHeader|SyncSubheader)\s*\)(?:([ \t]*:[ \t]*)(-?\d+))?/i;
const LINE_PLACEHOLDER = 'MPULINEPLACEHOLDER'; // letters only, so URL-encoding leaves it intact

function plannerPlugin(md) {
  // Inline rule that runs *before* markdown-it's link rule, so tags never
  // become links (VS Code would otherwise resolve "Counter" as a file path).
  md.inline.ruler.before('link', 'mpu_tag', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x5B /* [ */) return false;
    const m = INLINE_TAG.exec(state.src.slice(state.pos));
    if (!m) return false;
    if (!silent) {
      const key = m[2].toLowerCase();
      const label = escapeHtml(m[1]);
      const t = state.push('html_inline', '', 0);
      if (key === 'counter' && m[4] !== undefined && !state.env.__mpuCounterSeen) {
        const value = parseInt(m[4], 10);
        const link = (delta) => {
          const p = { line: LINE_PLACEHOLDER, expect: String(value), delta: String(delta) };
          const docUri = state.env && state.env.currentDocument;
          if (docUri) p.doc = docUri.toString();
          return vscode.env.uriScheme + '://' + EXT_ID + '/adjust?' + new URLSearchParams(p).toString();
        };
        t.content =
          '<span class="mpu-counter-label">' + label + '</span>: <span class="mdc-counter">' +
          '<a class="mdc-btn" title="Decrement" href="' + escapeHtml(link(-1)) + '">−</a>' +
          '<span class="mdc-value">' + value + '</span>' +
          '<a class="mdc-btn" title="Increment" href="' + escapeHtml(link(1)) + '">+</a>' +
          '</span>';
        state.env.__mpuCounterSeen = true; // only the first counter per line is clickable
      } else {
        const rest = key === 'counter' && m[4] !== undefined ? escapeHtml(m[3] + m[4]) : '';
        t.content = '<span class="mpu-' + key + '">' + label + '</span>' + rest;
      }
    }
    state.pos += m[0].length;
    return true;
  });

  // Inline rules don't know the source line; fill it in per block, and reset
  // the one-counter-per-line flag between blocks.
  const origParse = md.inline.parse.bind(md.inline);
  md.inline.parse = (str, mdi, env, outTokens) => {
    if (env) env.__mpuCounterSeen = false;
    return origParse(str, mdi, env, outTokens);
  };
  md.core.ruler.push('mpu_lines', (state) => {
    for (const tok of state.tokens) {
      if (tok.type !== 'inline' || !tok.children) continue;
      for (const c of tok.children) {
        if (c.type === 'html_inline' && c.content.includes(LINE_PLACEHOLDER)) {
          c.content = c.content.split(LINE_PLACEHOLDER).join(tok.map ? String(tok.map[0]) : '-1');
        }
      }
    }
  });
  return md;
}

/* =============================== Counters =============================== */

// Source line: anything up to the first "[Name](Counter):", then the number.
const COUNTER_SRC = new RegExp(`^(.*?\\[[^\\]\\n]+${tag('Counter')}[ \\t]*:[ \\t]*)(-?\\d+)`, 'i');

let lastMarkdownUri;

function isMd(uri) { return uri && /\.(md|markdown)$/i.test(uri.path); }

// Candidate documents, most likely first: the doc in the link, the active tab
// (the preview tab carries the .md uri), visible markdown editors, last active markdown editor.
function candidateUris(q) {
  const out = [];
  const add = (u) => { if (u && !out.some(x => x.toString() === u.toString())) out.push(u); };
  if (q.get('doc')) add(vscode.Uri.parse(q.get('doc')));
  const groups = vscode.window.tabGroups;
  const tabs = [groups.activeTabGroup.activeTab, ...groups.all.map(g => g.activeTab)];
  for (const tab of tabs) {
    const input = tab && tab.input;
    if (input && input.uri && isMd(input.uri)) add(input.uri);
  }
  for (const ed of vscode.window.visibleTextEditors) if (ed.document.languageId === 'markdown') add(ed.document.uri);
  add(lastMarkdownUri);
  for (const d of vscode.workspace.textDocuments) if (d.languageId === 'markdown') add(d.uri);
  return out;
}

async function adjust(uri) {
  const q = new URLSearchParams(uri.query);
  const line = parseInt(q.get('line'), 10);
  const expect = parseInt(q.get('expect'), 10);
  const delta = parseInt(q.get('delta'), 10);
  if (isNaN(line) || isNaN(expect) || isNaN(delta)) return;

  let doc, m;
  for (const cand of candidateUris(q)) {
    const d = await vscode.workspace.openTextDocument(cand);
    if (line >= d.lineCount) continue;
    const mm = COUNTER_SRC.exec(d.lineAt(line).text);
    if (mm && parseInt(mm[2], 10) === expect) { doc = d; m = mm; break; }
  }
  if (!doc) {
    vscode.window.showWarningMessage('Markdown Planner Utils: could not find the matching counter (it may have changed) — try again.');
    return;
  }
  let next = expect + delta;
  if (!cfg().get('counterAllowNegative', false) && next < 0) next = 0;
  if (next === expect) return;

  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, new vscode.Range(line, m[1].length, line, m[1].length + m[2].length), String(next));
  await vscode.workspace.applyEdit(edit);
  if (cfg().get('autoSave', true)) await doc.save();
}

/* ============================== Activation ============================== */

function activate(context) {
  const track = (ed) => { if (ed && ed.document.languageId === 'markdown') lastMarkdownUri = ed.document.uri; };
  track(vscode.window.activeTextEditor);
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(track));
  context.subscriptions.push(vscode.window.registerUriHandler({
    handleUri(uri) {
      const run = uri.path === '/toggle' ? toggle : uri.path === '/adjust' ? adjust : null;
      if (run) return run(uri).catch(e => vscode.window.showErrorMessage('Markdown Planner Utils: ' + e.message));
    }
  }));
  return { extendMarkdownIt: plannerPlugin };
}

function deactivate() {}

module.exports = { activate, deactivate, toggleAndSync, plannerPlugin, COUNTER_SRC };
