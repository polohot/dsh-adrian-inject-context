/**
 * adrian-inject-context host plugin.
 *
 * Single Loader row (see ../cordis.patch.yml) mounting this module.
 *
 *  1. agent/pre-step waterfall — the dsh-agent-instructions pattern — prepends
 *     this plugin's OWN independently-sourced user-role message
 *     ({ kind: 'plugin', plugin: 'adrian-inject-context:lessons' }) to the very
 *     front of every NON-EMPTY entering batch, so the request order per turn is
 *     system prompt, adrian-inject-context:lessons, the turn user message,
 *     everything else. Never injects into an empty batch: that is the agent
 *     loop's turn-close signal, and filling it would resurrect a finished turn.
 *  2. Store schema v2 at $DSH_HOME/adrian-inject-context.json:
 *     { version: 2, mode: 'simple' | 'advanced',
 *       simple: { lessons: [{id, text, enabled}] },
 *       advanced: { lessons: [{id, text, enabled}] } }
 *     The ACTIVE mode's dataset exclusively feeds the "Remember:" block; the
 *     other dataset is inert. v1 files ({"lessons":[...]}) migrate on first
 *     read to v2 with mode 'simple' and the old list under simple.lessons;
 *     seeding still happens only when the file is missing. Fresh read on every
 *     step; empty/all-disabled active dataset injects nothing.
 *  3. NO systemPrompt.section() and NO systemPrompt.context(): the system
 *     prompt and the shared runtime-context snapshot stay completely
 *     untouched.
 *  4. Management page at /adrian-inject-context plus /data, /save and a
 *     /prompt debug probe proving the guarantees.
 *
 * Only ctx APIs and standard globals are used (no cordis/dsh-* runtime
 * imports), so this module shares the host process's live instances.
 */

export const name = 'adrian-inject-context'

const NS = 'adrian-inject-context'
const SOURCE_NAME = NS + ':lessons'
const HEADER = 'Remember:'
const DATA_ROUTE = '/' + NS + '/data'
const SAVE_ROUTE = '/' + NS + '/save'
const PROBE_ROUTE = '/' + NS + '/prompt'

// The store sits in the harness home (~/.dsh by default, $DSH_HOME when set),
// outside any session workspace, so a workspace-write default fence would deny
// it. This plugin writes exactly one resolved target (the store file) and
// stamps the per-call policy the fs seam reserves for trusted host-side
// callers — the same stamp the tool layer applies after an approved escalation.
const STORE_WRITE_POLICY = { mode: 'danger-full-access', workspaceRoot: '' }

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>adrian-inject-context — Inject Context</title>
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; background: #0f1115; color: #e6e6e6; }
main { max-width: 780px; margin: 0 auto; padding: 28px 20px 64px; }
h1 { font-size: 18px; margin: 0 0 6px; letter-spacing: .2px; }
h1 code { font-size: 14px; color: #8ab4f8; }
p.sub { margin: 0 0 16px; color: #9aa0aa; }
.tabs { display: flex; gap: 4px; margin: 0 0 16px; }
.tab { border: none; background: transparent; cursor: pointer; font: inherit; font-size: 13px; line-height: 20px; height: 32px; padding: 0 12px; border-radius: 8px; color: #9aa0aa; }
.tab:hover { color: #e6e6e6; background: #1d232d; }
.tab.active { color: #8ab4f8; background: #1d232d; font-weight: 600; }
.lesson { display: grid; grid-template-columns: 1fr 64px; gap: 12px; align-items: stretch; padding: 12px; border: 1px solid #262b33; border-radius: 10px; margin-bottom: 10px; background: #161a21; }
.lesson.off { opacity: .55; }
.main { display: flex; gap: 10px; align-items: flex-start; min-width: 0; }
.main input[type="checkbox"] { flex: none; width: 16px; height: 16px; margin: 11px 0 0; accent-color: #4f8cff; cursor: pointer; }
.main textarea { flex: 1; min-width: 0; min-height: 88px; resize: vertical; background: #0f1115; color: #e6e6e6; border: 1px solid #2a303a; border-radius: 8px; padding: 8px 12px; font: inherit; font-size: 14px; line-height: 22px; }
.main textarea:focus { outline: none; border-color: #4f8cff; }
.actions { display: grid; grid-template-rows: auto 1fr; justify-items: center; align-items: center; }
.actions .badge { align-self: start; font-size: 12px; line-height: 18px; color: #6f7681; font-family: ui-monospace, monospace; }
.del { display: inline-flex; align-items: center; justify-content: center; align-self: center; min-width: 64px; height: 28px; padding: 0 10px; border-radius: 14px; cursor: pointer; font-size: 12px; line-height: 18px; color: #ff9d9d; background: transparent; border: 1px solid rgba(255, 157, 157, .35); }
.del:hover { background: rgba(255, 157, 157, .12); }
button.act { display: inline-flex; align-items: center; justify-content: center; gap: 4px; height: 36px; padding: 0 14px; border: none; border-radius: 18px; cursor: pointer; font-size: 14px; line-height: 22px; color: #e6e6e6; background: transparent; }
button.act:disabled { cursor: not-allowed; opacity: .4; }
button.act.primary { background: #2f6fed; color: #ffffff; }
button.act.primary:hover { background: #3b7bf0; }
button.act.outline { border: 1px solid #2a303a; }
button.act.outline:hover { background: #1d232d; }
.bar { display: flex; align-items: center; gap: 12px; margin-top: 18px; }
#status { font-size: 13px; color: #7fd18a; opacity: 0; transition: opacity .25s ease; }
#status.err { color: #ff9d9d; }
#status.show { opacity: 1; }
.meta { color: #6f7681; font-size: 12px; margin-top: 16px; line-height: 1.7; }
</style>
</head>
<body>
<main>
<h1><code>adrian-inject-context</code> — Inject Context</h1>
<p class="sub">Two independent datasets. The <b>active mode's</b> dataset exclusively feeds the standalone <b>Remember:</b> row injected immediately before your message on every turn; the other dataset is inert. Switching tabs persists the mode immediately.</p>
<div class="tabs">
<button class="tab active" id="tab-simple" type="button">Simple</button>
<button class="tab" id="tab-advanced" type="button">Advanced</button>
</div>
<div id="rows"></div>
<div class="bar">
<button id="add" class="act outline" type="button">Add Context</button>
<button id="save" class="act primary" type="button">Save</button>
<span id="status"></span>
</div>
<p class="meta" id="meta"></p>
<script>
(function () {
'use strict';
var rows = document.getElementById('rows');
var statusEl = document.getElementById('status');
var metaEl = document.getElementById('meta');
var saveBtn = document.getElementById('save');
var tabs = { simple: document.getElementById('tab-simple'), advanced: document.getElementById('tab-advanced') };
var statusTimer = null;
var store = null;
var tab = 'simple';
function showStatus(text, ok) {
  clearTimeout(statusTimer);
  statusEl.textContent = text;
  statusEl.className = ok ? 'show' : 'err show';
  statusTimer = setTimeout(function () { statusEl.className = ok ? '' : 'err'; }, 2600);
}
function activeLessons() { return store === null ? [] : (store[tab] ? store[tab].lessons : []); }
function makeRow(entry) {
  var row = document.createElement('div');
  row.className = 'lesson' + (entry.enabled === true ? '' : ' off');
  row.dataset.id = typeof entry.id === 'number' ? String(entry.id) : '';
  var main = document.createElement('div');
  main.className = 'main';
  var cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = entry.enabled === true;
  cb.title = 'enabled';
  cb.addEventListener('change', function () { row.className = 'lesson' + (cb.checked ? '' : ' off'); });
  var ta = document.createElement('textarea');
  ta.value = entry.text || '';
  ta.placeholder = 'Context text…';
  ta.setAttribute('aria-label', 'Context text');
  main.appendChild(cb);
  main.appendChild(ta);
  var actions = document.createElement('div');
  actions.className = 'actions';
  var badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = '#' + (typeof entry.id === 'number' ? entry.id : 'new');
  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'del';
  del.textContent = 'Delete';
  del.setAttribute('aria-label', 'Delete context');
  del.addEventListener('click', function () { row.remove(); });
  actions.appendChild(badge);
  actions.appendChild(del);
  row.appendChild(main);
  row.appendChild(actions);
  return row;
}
function render() {
  rows.textContent = '';
  var lessons = activeLessons();
  for (var i = 0; i < lessons.length; i++) rows.appendChild(makeRow(lessons[i]));
  tabs.simple.className = 'tab' + (tab === 'simple' ? ' active' : '');
  tabs.advanced.className = 'tab' + (tab === 'advanced' ? ' active' : '');
  setMeta();
}
function collect() {
  var out = [];
  for (var i = 0; i < rows.children.length; i++) {
    var row = rows.children[i];
    var item = { text: row.querySelector('textarea').value, enabled: row.querySelector('input[type=checkbox]').checked };
    if (row.dataset.id !== '') item.id = Number(row.dataset.id);
    out.push(item);
  }
  return out;
}
function currentEditsApplied() {
  var next = JSON.parse(JSON.stringify(store));
  next[tab].lessons = collect();
  next.mode = tab;
  return next;
}
function setMeta() {
  var lessons = activeLessons();
  var enabled = 0;
  for (var i = 0; i < lessons.length; i++) if (lessons[i].enabled === true && lessons[i].text.trim() !== '') enabled++;
  metaEl.textContent = '';
  metaEl.appendChild(document.createTextNode('Active mode: ' + (tab === 'advanced' ? 'Advanced' : 'Simple') + ' — ' + lessons.length + ' context(s), ' + enabled + ' enabled and injected. Store: '));
  var code = document.createElement('code');
  code.textContent = '~/.dsh/adrian-inject-context.json';
  metaEl.appendChild(code);
}
function postStore(next) {
  return fetch('/adrian-inject-context/save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(next) })
    .then(function (res) { return res.json().then(function (value) { return { ok: res.ok, value: value }; }); })
    .then(function (outcome) {
      if (!outcome.ok) throw new Error(outcome.value && outcome.value.error ? outcome.value.error : 'save failed');
      store = outcome.value;
      return outcome.value;
    });
}
function switchTab(next) {
  if (store === null || next === tab) return;
  tab = next;
  render();
  postStore(currentEditsApplied())
    .then(function (saved) { showStatus('mode: ' + (saved.mode === 'advanced' ? 'Advanced' : 'Simple') + ' ✓', true); })
    .catch(function (error) { showStatus('mode save failed: ' + (error && error.message ? error.message : String(error)), false); });
}
tabs.simple.addEventListener('click', function () { switchTab('simple'); });
tabs.advanced.addEventListener('click', function () { switchTab('advanced'); });
document.getElementById('add').addEventListener('click', function () {
  if (store === null) return;
  rows.appendChild(makeRow({ id: null, text: '', enabled: true }));
  var areas = rows.querySelectorAll('textarea');
  areas[areas.length - 1].focus();
});
saveBtn.addEventListener('click', function () {
  if (store === null) return;
  saveBtn.disabled = true;
  postStore(currentEditsApplied())
    .then(function (saved) {
      render();
      var lessons = saved[saved.mode] ? saved[saved.mode].lessons : [];
      showStatus('saved ✓ (' + lessons.length + ' context(s) in ' + (saved.mode === 'advanced' ? 'Advanced' : 'Simple') + ')', true);
    })
    .catch(function (error) { showStatus('save failed: ' + (error && error.message ? error.message : String(error)), false); })
    .then(function () { saveBtn.disabled = false; });
});
fetch('/adrian-inject-context/data', { cache: 'no-store' })
  .then(function (res) { return res.json(); })
  .then(function (value) {
    store = value && typeof value === 'object' ? value : null;
    if (store !== null) tab = store.mode === 'advanced' ? 'advanced' : 'simple';
    render();
  })
  .catch(function (error) { showStatus('load failed: ' + (error && error.message ? error.message : String(error)), false); });
})();
</script>
</main>
</body>
</html>`

export function apply(ctx) {
  // Loader-loaded plugins must DECLARE every service they touch via inject —
  // the dynamic-mount façade hid this requirement. First-party form (dshmarket:
  // ctx.inject(['webServer', 'loader'], …)): the callback receives a fiber
  // context with those services declared, parked until they are available.
  // Audit of every ctx.<service> access in this file: ctx.fs (resolve/
  // readText/stat/writeText) and ctx.webServer (register/host/port) — both
  // declared here; ctx.get('dshHomePath') and ctx.get('systemPrompt') use the
  // declaration-free optional lookup; ctx.on and ctx.effect are lifecycle
  // verbs, not services.
  ctx.inject(['webServer', 'fs'], async (hostCtx) => {
  const ctx = hostCtx

  // The store lives in the harness home (~/.dsh by default, $DSH_HOME when
  // set) so it outlives any single profile boot. Resolved through the
  // dshHomePath value dsh-app-boot provides on the root context.
  const dshHomePath = ctx.get('dshHomePath')
  if (typeof dshHomePath !== 'function') {
    throw new Error(NS + ': the dshHomePath provided value is unavailable on this host context')
  }
  const storePath = dshHomePath('adrian-inject-context.json')

  function seedDocument() {
    return JSON.stringify({
      version: 2,
      mode: 'simple',
      simple: { lessons: [{ id: 1, text: 'Always confirm before deleting files.', enabled: true }] },
      advanced: { lessons: [] }
    }, null, 2) + '\n'
  }

  function emptyStore() {
    return { version: 2, mode: 'simple', simple: { lessons: [] }, advanced: { lessons: [] } }
  }

  // Coerce one dataset's raw list into canonical rows: text string, enabled
  // boolean, unique numeric ids WITHIN the dataset (existing unique ids are
  // preserved; missing or duplicated ones get fresh numbers above the max).
  function normalizeDataset(source) {
    const claimed = new Set()
    let max = 0
    const kept = []
    for (const row of source) {
      if (row === null || typeof row !== 'object' || Array.isArray(row)) continue
      const hasId = typeof row.id === 'number' && Number.isFinite(row.id) && row.id >= 0 && !claimed.has(row.id)
      if (hasId) {
        claimed.add(row.id)
        if (row.id > max) max = row.id
      }
      kept.push({ hasId: hasId, id: hasId ? row.id : -1, text: typeof row.text === 'string' ? row.text : String(row.text === undefined ? '' : row.text), enabled: row.enabled === true })
    }
    let next = max + 1
    for (const row of kept) {
      if (row.hasId) continue
      while (claimed.has(next)) next = next + 1
      claimed.add(next)
      row.id = next
    }
    return kept.map(function (row) { return { id: row.id, text: row.text, enabled: row.enabled } })
  }

  function datasetOf(value) {
    return value !== null && typeof value === 'object' && Array.isArray(value.lessons) ? value.lessons : null
  }

  // Coerce any parsed store into canonical v2. v1 ({"lessons":[...]}) becomes
  // { mode 'simple', simple: old list, advanced: [] } — never loses rows.
  function normalizeStore(parsed) {
    const store = emptyStore()
    if (parsed === null || typeof parsed !== 'object') return store
    if (parsed.version === 2) {
      store.mode = parsed.mode === 'advanced' ? 'advanced' : 'simple'
      const simple = datasetOf(parsed.simple)
      const advanced = datasetOf(parsed.advanced)
      store.simple.lessons = normalizeDataset(simple === null ? [] : simple)
      store.advanced.lessons = normalizeDataset(advanced === null ? [] : advanced)
      return store
    }
    if (Array.isArray(parsed.lessons)) {
      store.simple.lessons = normalizeDataset(parsed.lessons)
      return store
    }
    return store
  }

  function serializeStore(store) {
    return JSON.stringify(store, null, 2) + '\n'
  }

  // Always read fresh from disk: no watcher, no cache. A v1 file is migrated
  // (and the migration persisted immediately, so the upgrade survives even
  // without a later save). Any read or parse failure yields an empty store so
  // a missing or corrupt file contributes nothing instead of breaking a step.
  async function readStore() {
    try {
      const target = await ctx.fs.resolve(storePath)
      const raw = await ctx.fs.readText(target)
      const parsed = JSON.parse(raw)
      const store = normalizeStore(parsed)
      if (parsed === null || typeof parsed !== 'object' || parsed.version !== 2) {
        try {
          await ctx.fs.writeText(target, serializeStore(store), undefined, undefined, STORE_WRITE_POLICY)
          console.log(NS + ': migrated store to schema v2 at ' + storePath)
        } catch (error) {
          console.error(NS + ': store migration persist failed:', error instanceof Error ? error.message : String(error))
        }
      }
      return store
    } catch (error) {
      return emptyStore()
    }
  }

  function activeLessons(store) {
    const dataset = store.mode === 'advanced' ? store.advanced : store.simple
    return dataset !== null && typeof dataset === 'object' && Array.isArray(dataset.lessons) ? dataset.lessons : []
  }

  function renderBlock(store) {
    const lines = []
    for (const entry of activeLessons(store)) {
      if (entry.enabled !== true) continue
      if (entry.text.trim().length === 0) continue
      lines.push('- ' + entry.text)
    }
    if (lines.length === 0) return ''
    return HEADER + '\n' + lines.join('\n')
  }

  function readBody(req, limit) {
    return new Promise(function (resolve, reject) {
      const decoder = new TextDecoder()
      let body = ''
      let size = 0
      let done = false
      req.on('error', function (error) {
        if (done) return
        done = true
        reject(error)
      })
      req.on('data', function (chunk) {
        if (done) return
        size += chunk.length
        if (size > limit) {
          done = true
          reject(new Error('request body exceeds ' + limit + ' bytes'))
          req.destroy()
          return
        }
        body += decoder.decode(chunk, { stream: true })
      })
      req.on('end', function () {
        if (done) return
        done = true
        resolve(body + decoder.decode())
      })
    })
  }

  function sendJson(res, status, value) {
    const body = JSON.stringify(value)
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(body)
  }

  // -----------------------------------------------------------------------
  // Injection mechanism: the agent/pre-step waterfall — the same pattern
  // dsh-agent-instructions uses. NO systemPrompt.section() and NO
  // systemPrompt.context(): the system prompt and the shared runtime-context
  // snapshot stay completely untouched. After the default decision (which
  // appends the runtime-context snapshot message last) this listener PREPENDS
  // this plugin's own independently-sourced user-role message at the very
  // front of the entering batch, so the appended surface order is
  // [adrian row, user message(s), snapshot, ...]. The message source is
  // { kind: 'plugin', plugin: 'adrian-inject-context:lessons' }. Fresh store
  // read on every step; empty/all-disabled active dataset => nothing injected.
  //
  // Emission rule — inject ONLY into a batch that is already non-empty: an
  // empty entering batch is the agent loop's turn-completion signal, and
  // filling it would resurrect a finished turn. Non-empty batches are the
  // legitimate entry points (turn boundaries with claimed user input, and
  // mid-turn steps where a snapshot or another listener already contributes).
  // Within those, a fresh row is emitted at every turn boundary and whenever
  // the block changed or no current row exists.
  // -----------------------------------------------------------------------

  function firstText(message) {
    if (message === null || typeof message !== 'object' || !Array.isArray(message.content)) return ''
    for (const block of message.content) {
      if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') return block.text
    }
    return ''
  }

  function describeSource(message) {
    const source = message === null || typeof message !== 'object' ? undefined : message.source
    if (source === null || typeof source !== 'object') return 'unknown'
    if (source.kind === 'plugin') return 'plugin:' + String(source.plugin)
    if (source.kind === 'tool') return 'tool-result'
    if (source.kind === 'model') return 'model'
    if (source.kind === 'user') return 'user'
    if (typeof source.kind === 'string') return String(source.kind)
    return 'unknown'
  }

  function isMine(message) {
    const source = message === null || typeof message !== 'object' ? undefined : message.source
    return source !== null && typeof source === 'object' && source.kind === 'plugin' && source.plugin === SOURCE_NAME
  }

  // Newest adrian row currently on the agent's request surface (compaction may
  // have pruned older ones; the scan reflects exactly that).
  function scanSurface(agent) {
    const session = agent.session
    let found = undefined
    let count = 0
    for (const seq of session.surface.nodes) {
      const event = session.eventAt(seq)
      if (event === undefined || event.type !== 'user/message') continue
      const message = event.data
      if (!isMine(message)) continue
      count += 1
      found = { seq: seq, text: firstText(message) }
    }
    return { found: found, count: count }
  }

  let idCounter = 0
  function makeMessage(block) {
    idCounter += 1
    const id = NS + '-' + Date.now() + '-' + idCounter + '-' + Math.floor(Math.random() * 1e9).toString(36)
    return {
      id: id,
      role: 'user',
      content: [{ type: 'text', text: block }],
      source: { kind: 'plugin', plugin: SOURCE_NAME }
    }
  }

  // Live agent of the last observed step; held only to read surface leaves for
  // the probe and never serialized.
  let lastAgent = undefined
  const records = []

  function pushRecord(payload, messages, injected, block, note) {
    const batch = []
    for (const message of messages) {
      const preview = firstText(message).replace(/\s+/g, ' ').slice(0, 70)
      batch.push({ role: message.role, source: describeSource(message), adrianRow: isMine(message), preview: preview })
    }
    records.push({
      turn: payload.turn,
      step: payload.step,
      turnBoundary: payload.messages.length > 0,
      injected: injected,
      contextText: block,
      note: note === undefined ? '' : note,
      batchOrder: batch
    })
    if (records.length > 6) records.splice(0, records.length - 6)
  }

  ctx.on('agent/pre-step', async function (payload, next) {
    const decision = await next()
    try {
      if (decision.kind !== 'enter') {
        pushRecord(payload, [], false, '', 'step rejected by a later listener')
        return decision
      }
      const agent = payload.agent
      lastAgent = agent
      const block = renderBlock(await readStore())
      const existing = scanSurface(agent)
      const turnBoundary = payload.messages.length > 0
      // Never inject into an empty batch: that is the loop's turn-close
      // signal, and filling it would resurrect a completed turn.
      const canEnter = decision.messages.length > 0
      let inject = false
      if (block !== '' && canEnter) {
        inject = turnBoundary || existing.found === undefined || existing.found.text !== block
      }
      if (!inject) {
        const note = block === '' ? 'nothing enabled this step' : !canEnter ? 'empty entering batch (turn closing) — correctly not injected' : 'row already current'
        pushRecord(payload, decision.messages, false, block, note)
        return decision
      }
      const entered = [makeMessage(block)].concat(decision.messages)
      pushRecord(payload, entered, true, block, turnBoundary ? 'prepended at front of entering batch (before the user message)' : 'block changed / row missing — prepended at front of a non-empty batch')
      return { ...decision, messages: entered }
    } catch (error) {
      console.error(NS + ': pre-step injection failed for one step:', error instanceof Error ? error.message : String(error))
      return decision
    }
  })

  // Store bootstrap: create the file with the seeded entry only when it does
  // not exist yet (v1 files migrate on first read), then log the active mode.
  try {
    const target = await ctx.fs.resolve(storePath)
    const info = await ctx.fs.stat(target)
    if (info === undefined) {
      await ctx.fs.writeText(target, seedDocument(), { kind: 'createIfAbsent' }, undefined, STORE_WRITE_POLICY)
      console.log(NS + ': seeded store at ' + storePath)
    }
    const store = await readStore()
    console.log('[' + NS + '] active mode: ' + store.mode + ' (simple: ' + store.simple.lessons.length + ', advanced: ' + store.advanced.lessons.length + ' entries)')
  } catch (error) {
    console.error(NS + ': store bootstrap failed:', error instanceof Error ? error.message : String(error))
  }

  // Management UI. webServer.register only mutates the route tables and
  // returns a disposer, so each route is wrapped in ctx.effect to keep it
  // reversible when this plugin stops.
  ctx.effect(function () {
    return ctx.webServer.register({ kind: 'exact', path: '/' + NS, handler: function (req, res) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(PAGE)
    } })
  }, NS + ': page route')

  ctx.effect(function () {
    return ctx.webServer.register({ kind: 'exact', path: DATA_ROUTE, handler: function (req, res) {
      readStore().then(function (store) {
        sendJson(res, 200, store)
      }, function (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      })
    } })
  }, NS + ': data route')

  // POST /save — accepts { mode?, simple?, advanced? }: any dataset supplied
  // as { lessons: [...] } replaces that dataset; a valid mode replaces the
  // mode; anything absent keeps its current value. Writes the whole v2 store
  // atomically (single write) and returns the canonical result.
  ctx.effect(function () {
    return ctx.webServer.register({ kind: 'exact', path: SAVE_ROUTE, handler: function (req, res) {
      Promise.resolve().then(function () { return readBody(req, 1024 * 1024) }).then(function (body) {
        let parsed
        try {
          parsed = body.trim().length === 0 ? {} : JSON.parse(body)
        } catch (error) {
          sendJson(res, 400, { error: 'request body is not valid JSON: ' + (error instanceof Error ? error.message : String(error)) })
          return null
        }
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
          sendJson(res, 400, { error: 'request body must be a JSON object: { mode, simple, advanced }' })
          return null
        }
        return readStore().then(function (store) {
          if (parsed.mode === 'simple' || parsed.mode === 'advanced') store.mode = parsed.mode
          const simple = datasetOf(parsed.simple)
          const advanced = datasetOf(parsed.advanced)
          if (simple !== null) store.simple.lessons = normalizeDataset(simple)
          if (advanced !== null) store.advanced.lessons = normalizeDataset(advanced)
          return store
        })
      }).then(function (store) {
        if (store === null) return
        return ctx.fs.resolve(storePath).then(function (target) {
          return ctx.fs.writeText(target, serializeStore(store), undefined, undefined, STORE_WRITE_POLICY)
        }).then(function () {
          sendJson(res, 200, store)
        })
      }).catch(function (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      })
    } })
  }, NS + ': save route')

  // Debug probe: proves (a) the assembled system prompt contains no adrian
  // section and no injected-block text, (b) the shared runtime-context
  // snapshot contains no adrian contribution and no injected-block text, and
  // (c) the separate sourced message exists with the current block, plus the
  // numbered request-message order and the store's mode/counts.
  ctx.effect(function () {
    return ctx.webServer.register({ kind: 'exact', path: PROBE_ROUTE, handler: function (req, res) {
      const systemPrompt = ctx.get('systemPrompt')
      Promise.resolve().then(function () {
        return systemPrompt === undefined ? undefined : systemPrompt.assemble()
      }).then(function (assembly) {
        return readStore().then(function (store) {
          const active = activeLessons(store)
          let activeEnabled = 0
          for (const entry of active) if (entry.enabled === true && entry.text.trim().length > 0) activeEnabled += 1
          const report = {
            plugin: NS,
            sourceName: SOURCE_NAME,
            header: HEADER,
            mechanism: 'agent/pre-step entering-batch prepend (dsh-agent-instructions pattern); no systemPrompt.section(), no systemPrompt.context(); never injected into an empty (turn-closing) batch',
            store: {
              schema: 2,
              mode: store.mode,
              simpleEntries: store.simple.lessons.length,
              advancedEntries: store.advanced.lessons.length,
              activeEntries: active.length,
              activeEnabled: activeEnabled
            }
          }
          if (assembly === undefined) {
            report.systemPrompt = { available: false }
          } else {
            const sectionNames = []
            let adrianSections = 0
            let blockTextInSections = 0
            for (const section of assembly.sections) {
              sectionNames.push(section.name)
              if (section.name.indexOf(NS) !== -1) adrianSections += 1
              if (section.text.indexOf(HEADER) !== -1) blockTextInSections += 1
            }
            const contextNames = []
            let adrianContexts = 0
            let blockTextInSnapshot = 0
            for (const entry of assembly.contexts) {
              contextNames.push(entry.name)
              if (entry.name.indexOf(NS) !== -1) adrianContexts += 1
              if (entry.text.indexOf(HEADER) !== -1) blockTextInSnapshot += 1
            }
            report.systemPrompt = {
              available: true,
              untouched: adrianSections === 0 && blockTextInSections === 0,
              adrianSectionCount: adrianSections,
              sectionNamesWithBlockText: blockTextInSections,
              sectionNames: sectionNames
            }
            report.runtimeContextSnapshot = {
              untouched: adrianContexts === 0 && blockTextInSnapshot === 0,
              adrianContextCount: adrianContexts,
              entriesWithBlockText: blockTextInSnapshot,
              contextNames: contextNames
            }
          }
          if (lastAgent === undefined) {
            report.sourcedMessage = { status: 'pending — no agent step has run since boot' }
          } else {
            const session = lastAgent.session
            const rows = []
            let myLastIndex = -1
            let myCount = 0
            for (const seq of session.surface.nodes) {
              const event = session.eventAt(seq)
              if (event === undefined) continue
              let message = undefined
              if (event.type === 'user/message') message = event.data
              else if (event.type === 'assistant/message' || event.type === 'tool/result') message = event.data.message
              if (message === undefined) continue
              const mine = isMine(message)
              if (mine) {
                myCount += 1
                myLastIndex = rows.length
              }
              rows.push({ role: message.role, source: describeSource(message), adrianRow: mine, preview: firstText(message).replace(/\s+/g, ' ').slice(0, 70) })
            }
            const numbered = [{ n: 1, role: 'system', source: 'system-prompt', adrianRow: false, preview: '(request system prompt — assembled separately, provably without injected-block text)' }]
            for (let i = 0; i < rows.length; i++) numbered.push({ n: i + 2, role: rows[i].role, source: rows[i].source, adrianRow: rows[i].adrianRow, preview: rows[i].preview })
            let order
            if (numbered.length <= 18) {
              order = numbered
            } else {
              const head = numbered.slice(0, 3)
              const around = myLastIndex >= 0 ? numbered.slice(Math.max(3, myLastIndex - 1), Math.min(numbered.length, myLastIndex + 4)) : []
              const tail = numbered.slice(Math.max(3, numbered.length - 7))
              const shown = new Set()
              for (const row of head.concat(around).concat(tail)) shown.add(row.n)
              order = numbered.filter(function (row) { return shown.has(row.n) })
              order.push({ n: '...', omitted: numbered.length - order.length })
            }
            report.sourcedMessage = {
              status: myCount > 0 ? 'present' : 'pending — no row appended yet (rows are emitted at turn boundaries)',
              surfaceMessageCount: rows.length,
              adrianRowsOnSurface: myCount,
              lastAdrianRowRequestPosition: myLastIndex >= 0 ? myLastIndex + 2 : -1,
              positionNote: 'Position 1 is the system prompt. Each emitted row is prepended to the very front of that turn entering batch, so the request order for the turn is: system prompt, adrian-inject-context:lessons, the turn user message, then everything else. Rows from earlier turns remain earlier in history exactly like the built-in runtime-context snapshots.',
              requestMessageOrder: order,
              recentInjections: records
            }
          }
          sendJson(res, 200, report)
        })
      }).catch(function (error) {
        sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
      })
    } })
  }, NS + ': prompt debug probe')

  console.log('[' + NS + '] management UI: http://' + ctx.webServer.host + ':' + ctx.webServer.port + '/' + NS)
  console.log('[' + NS + '] store: ' + storePath)
  })
}
