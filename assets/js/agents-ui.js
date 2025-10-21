// assets/js/agents-ui.js
// Agents UI v1 — region filter, editable names, skills matrix, PTO drawer + calendar
// Dépendances: Supabase JS. On tente d'utiliser window.supabase si déjà initialisé.
// Sinon, on charge @supabase/supabase-js via ESM et on crée le client avec window.SUPABASE_URL/KEY.

let supabase = window.supabase;
async function ensureSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const url = window.SUPABASE_URL || window.SUPABASE_URL_PUBLIC || window.SUPABASE_URL_BASE;
  const key = window.SUPABASE_ANON_KEY || window.SUPABASE_PUBLIC_ANON_KEY;
  if (!url || !key) {
    console.warn('[AgentsUI] SUPABASE_URL / SUPABASE_ANON_KEY manquants. Lecture/écriture désactivées.');
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

// ——— Modèle de compétences (10 colonnes) ———
const SKILL_KEYS = [
  'Call','Mail','Chat','Clienteling','Fraud',
  'Back Office','Lunch Break','Break','Morning Brief','Training'
];

// Valeurs par défaut (true partout)
function defaultSkills() {
  const s = {};
  SKILL_KEYS.forEach(k => s[k] = true);
  return s;
}

// ——— helpers DOM ———
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
function el(tag, attrs = {}, html) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k, v));
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ——— UI root ———
const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];

let CURRENT_REGION = 'Europe';         // fallback UI
let AGENTS_CACHE = [];                 // {id, full_name, region, skills, active}
let PTO_CACHE = new Map();             // key=agent_id, value=Set of 'YYYY-MM-DD:HALF' (HALF in AM/PM/FULL)

function ymd(d) { return d.toISOString().slice(0,10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }

// ——— PTO overlay / drawer ———
function openPtoDrawer(agent) {
  closePtoDrawer(); // ensure singleton

  const overlay = el('div', { class: 'drawer-overlay', id: 'ptoOverlay' });
  const drawer  = el('div', { class: 'drawer-panel', id: 'ptoDrawer' });

  const title = el('div', { class: 'drawer-title' }, `PTO — ${agent.full_name}`);
  const form = el('div', { class: 'drawer-form' });

  // Start / End date
  const startRow = el('div', { class: 'drawer-row' });
  startRow.innerHTML = `
    <label>Start date</label>
    <input type="date" id="ptoStart">
  `;
  const endRow = el('div', { class: 'drawer-row' });
  endRow.innerHTML = `
    <label>End date</label>
    <input type="date" id="ptoEnd">
  `;

  // Half-day select
  const halfRow = el('div', { class: 'drawer-row' });
  halfRow.innerHTML = `
    <label>Half day</label>
    <select id="ptoHalf">
      <option value="FULL" selected>FULL (all day)</option>
      <option value="AM">AM (morning)</option>
      <option value="PM">PM (afternoon)</option>
    </select>
  `;

  // Note
  const noteRow = el('div', { class: 'drawer-row' });
  noteRow.innerHTML = `
    <label>Note</label>
    <input type="text" id="ptoNote" placeholder="optional note">
  `;

  // Actions
  const actions = el('div', { class: 'drawer-actions' });
  const btnSave = el('button', { class: 'btn' }, 'Save PTO');
  const btnCancel = el('button', { class: 'btn ghost' }, 'Cancel');

  btnCancel.addEventListener('click', closePtoDrawer);
  btnSave.addEventListener('click', async () => {
    const sb = await ensureSupabase();
    if (!sb) { alert('Supabase non initialisé.'); return; }

    const s = $('#ptoStart')?.value;
    const e = $('#ptoEnd')?.value || s;
    const half = $('#ptoHalf')?.value || 'FULL';
    const note = $('#ptoNote')?.value || null;
    if (!s) { alert('Pick a start date'); return; }

    const d0 = new Date(s);
    const d1 = new Date(e);
    if (isNaN(d0.getTime()) || isNaN(d1.getTime()) || d1 < d0) {
      alert('Date range invalid'); return;
    }

    // insert all days in range (upsert via unique(agent_id,date,half_day))
    const rows = [];
    for (let d = new Date(d0); d <= d1; d = addDays(d, 1)) {
      rows.push({ agent_id: agent.id, date: ymd(d), half_day: half, note });
    }

    // batch insert with onConflict
    const { error } = await sb
      .from('agent_pto')
      .upsert(rows, { onConflict: 'agent_id,date,half_day' });

    if (error) {
      console.error(error);
      alert('PTO save failed.');
    } else {
      // refresh PTO cache for this agent
      await loadPtoForAgent(agent.id);
      alert('PTO saved ✔');
      closePtoDrawer();
    }
  });

  actions.append(btnSave, btnCancel);
  form.append(startRow, endRow, halfRow, noteRow, actions);
  drawer.append(title, form);
  overlay.append(drawer);
  document.body.append(overlay);

  // close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePtoDrawer();
  });
}
function closePtoDrawer() {
  $('#ptoOverlay')?.remove();
}

// ——— PTO Calendar modal ———
function openPtoCalendar(agent) {
  closePtoCalendar();

  const overlay = el('div', { class: 'modal-overlay', id: 'ptoCalOverlay' });
  const modal   = el('div', { class: 'modal', id: 'ptoCalModal' });
  const title   = el('div', { class: 'modal-title' }, `PTO — next 28 days — ${agent.full_name}`);

  const grid    = el('div', { class: 'calendar-grid' });

  const start = new Date(); start.setHours(0,0,0,0);
  const days = 28;
  for (let i=0;i<days;i++) {
    const d = addDays(start, i);
    const keyFull = `${ymd(d)}:FULL`;
    const keyAM   = `${ymd(d)}:AM`;
    const keyPM   = `${ymd(d)}:PM`;
    const cell = el('div', { class: 'calendar-cell' });
    const label = el('div', { class: 'cell-date' }, d.toLocaleDateString(undefined, { month:'short', day:'numeric' }));

    // background / diagonal if half-day
    const hasFull = PTO_CACHE.get(agent.id)?.has(keyFull);
    const hasAM   = PTO_CACHE.get(agent.id)?.has(keyAM);
    const hasPM   = PTO_CACHE.get(agent.id)?.has(keyPM);

    if (hasFull) {
      cell.classList.add('pto-full'); // full red
    } else if (hasAM || hasPM) {
      cell.classList.add('pto-half'); // diagonale
      // annotate where?
      const sub = el('div', { class: 'cell-half-tag' }, hasAM && hasPM ? 'AM+PM' : (hasAM ? 'AM' : 'PM'));
      cell.append(sub);
    }

    cell.append(label);
    grid.append(cell);
  }

  const actions = el('div', { class: 'modal-actions' });
  const btnClose = el('button', { class: 'btn' }, 'Close');
  btnClose.addEventListener('click', closePtoCalendar);

  actions.append(btnClose);
  modal.append(title, grid, actions);
  overlay.append(modal);
  document.body.append(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePtoCalendar();
  });
}
function closePtoCalendar() {
  $('#ptoCalOverlay')?.remove();
}

// ——— Récup ———
async function loadAgents(region) {
  const sb = await ensureSupabase();
  if (!sb) { AGENTS_CACHE = []; return []; }

  let q = sb.from('agents').select('id, full_name, region, skills, active').order('full_name', { ascending: true });
  if (region) q = q.eq('region', region);
  const { data, error } = await q;
  if (error) { console.error('[AgentsUI] loadAgents', error); AGENTS_CACHE = []; return []; }
  AGENTS_CACHE = data || [];
  return AGENTS_CACHE;
}

async function loadPtoForAgent(agentId) {
  const sb = await ensureSupabase();
  if (!sb) return;
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = addDays(start, 60); // on prend large
  const { data, error } = await sb
    .from('agent_pto')
    .select('date, half_day')
    .eq('agent_id', agentId)
    .gte('date', ymd(start))
    .lte('date', ymd(end));
  if (error) { console.error('[AgentsUI] loadPTO', error); return; }
  const set = new Set();
  (data||[]).forEach(r => set.add(`${r.date}:${r.half_day}`));
  PTO_CACHE.set(agentId, set);
}

async function loadPtoForAgents(agentIds) {
  const sb = await ensureSupabase();
  if (!sb || !agentIds.length) return;
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = addDays(start, 60);
  const { data, error } = await sb
    .from('agent_pto')
    .select('agent_id, date, half_day')
    .in('agent_id', agentIds)
    .gte('date', ymd(start))
    .lte('date', ymd(end));
  if (error) { console.error('[AgentsUI] loadPTO', error); return; }
  PTO_CACHE.clear();
  (data||[]).forEach(r => {
    if (!PTO_CACHE.has(r.agent_id)) PTO_CACHE.set(r.agent_id, new Set());
    PTO_CACHE.get(r.agent_id).add(`${r.date}:${r.half_day}`);
  });
}

// ——— Ecriture ———
async function upsertAgent(agent) {
  const sb = await ensureSupabase();
  if (!sb) return { error: new Error('No Supabase') };
  // merge skills defaults
  const mergedSkills = { ...defaultSkills(), ...(agent.skills || {}) };
  const payload = {
    id: agent.id,
    full_name: agent.full_name,
    region: agent.region || CURRENT_REGION,
    active: agent.active ?? true,
    skills: mergedSkills
  };
  // upsert by primary key (id) si présent, sinon insert
  const { data, error } = await sb.from('agents').upsert(payload).select().limit(1).single();
  if (!error && data?.id) agent.id = data.id;
  return { data, error };
}
async function deleteAgent(agentId) {
  const sb = await ensureSupabase();
  if (!sb) return { error: new Error('No Supabase') };
  const { error } = await sb.from('agents').delete().eq('id', agentId);
  return { error };
}

// ——— Rendu UI ———
function buildAgentsSectionRoot() {
  const host = $('#tab-Agents');
  host.innerHTML = '';
  const head = el('div', { class:'row', style:'margin-bottom:8px' });

  // Region filter
  const lab = el('label', { class:'muted' }, 'Region:');
  const sel = el('select', { class:'input', id:'agRegionFilter' });
  REGIONS.forEach(r => {
    const opt = el('option'); opt.value=r; opt.textContent=r; if (r===CURRENT_REGION) opt.selected = true;
    sel.append(opt);
  });

  // Buttons
  const btnAdd    = el('button', { class:'btn', id:'agAdd' }, 'Add agent');
  const btnExport = el('button', { class:'btn ghost', id:'agExport' }, 'Export CSV');
  const badge     = el('span', { class:'badge', id:'agCount', style:'margin-left:auto' }, '0 agents');

  head.append(lab, sel, btnAdd, btnExport, badge);

  // Table
  const card = el('div', { class:'card', style:'padding:12px;margin:12px 0' });
  const tableWrap = el('div', { class:'scroll-x' }); // scroll horizontal pour petits écrans
  const table = el('table', { id:'agMatrix' });

  // Head with rotated skill headers
  const thead = el('thead');
  const headRow = el('tr');
  headRow.append(el('th', {}, 'Agent'));
  SKILL_KEYS.forEach(sk => {
    const th = el('th', { class:'th-rotate' });
    const inner = el('div', { class:'rotate' }, sk);
    th.append(inner);
    headRow.append(th);
  });
  headRow.append(el('th', {}, 'PTO'), el('th', {}, 'Calendar'), el('th', {}, 'Delete'));
  thead.append(headRow);

  const tbody = el('tbody');
  table.append(thead, tbody);
  tableWrap.append(table);
  card.append(cardTitle('A. Agents & skills'), descr('All skills are ON by default. Uncheck to opt out.'), tableWrap);

  host.append(head, card);
}

function cardTitle(t) { return el('h4', { style:'margin:0 0 8px 0' }, t); }
function descr(t)     { return el('div', { class:'muted', style:'margin-bottom:6px' }, t); }

function renderAgentRows() {
  const tbody = $('#agMatrix tbody');
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  AGENTS_CACHE.forEach(agent => {
    const tr = el('tr');

    // Agent name
    const tdName = el('td');
    const inp = el('input', { class:'input', value: agent.full_name });
    inp.addEventListener('change', async () => {
      agent.full_name = inp.value.trim() || agent.full_name;
      const { error } = await upsertAgent(agent);
      if (error) { alert('Save failed'); console.error(error); }
    });
    tdName.append(inp); tr.append(tdName);

    // Skills checkboxes
    const skills = { ...defaultSkills(), ...(agent.skills||{}) };
    SKILL_KEYS.forEach(key => {
      const td = el('td', { class:'mono center' });
      const chk = el('input', { type:'checkbox' });
      chk.checked = !!skills[key];
      chk.addEventListener('change', async () => {
        agent.skills = { ...skills, [key]: chk.checked };
        const { error } = await upsertAgent(agent);
        if (error) { alert('Save failed'); console.error(error); }
      });
      td.append(chk);
      tr.append(td);
    });

    // PTO buttons
    const tdPto = el('td');
    const bPto  = el('button', { class:'btn ghost' }, 'PTO');
    bPto.addEventListener('click', () => openPtoDrawer(agent));
    tdPto.append(bPto); tr.append(tdPto);

    const tdCal = el('td');
    const bCal  = el('button', { class:'btn ghost' }, 'Calendar');
    bCal.addEventListener('click', () => openPtoCalendar(agent));
    tdCal.append(bCal); tr.append(tdCal);

    // Delete
    const tdDel = el('td');
    const bDel  = el('button', { class:'btn ghost' }, 'Delete');
    bDel.addEventListener('click', async () => {
      if (!confirm(`Delete ${agent.full_name}?`)) return;
      const { error } = await deleteAgent(agent.id);
      if (error) { alert('Delete failed'); console.error(error); return; }
      await refreshAgents();
    });
    tdDel.append(bDel); tr.append(tdDel);

    frag.append(tr);
  });

  tbody.append(frag);
  const badge = $('#agCount'); if (badge) badge.textContent = `${AGENTS_CACHE.length} agents`;
}

async function refreshAgents() {
  await loadAgents(CURRENT_REGION);
  await loadPtoForAgents(AGENTS_CACHE.map(a => a.id));
  renderAgentRows();
}

// ——— Wiring ———
function wireAgentsUI() {
  $('#agAdd')?.addEventListener('click', async () => {
    const name = prompt('Agent full name:');
    if (!name) return;
    const agent = {
      full_name: name.trim(),
      region: CURRENT_REGION,
      active: true,
      skills: defaultSkills()
    };
    const { error } = await upsertAgent(agent);
    if (error) { alert('Insert failed'); console.error(error); return; }
    await refreshAgents();
  });

  $('#agExport')?.addEventListener('click', () => {
    const headers = ['full_name', ...SKILL_KEYS.map(k => `skill_${k.replace(/\s+/g,'_').toLowerCase()}`)];
    const lines = [headers.join(',')];
    AGENTS_CACHE.forEach(a => {
      const sk = { ...defaultSkills(), ...(a.skills||{}) };
      const row = [
        JSON.stringify(a.full_name),
        ...SKILL_KEYS.map(k => sk[k] ? '1' : '0')
      ];
      lines.push(row.join(','));
    });
    const blob = new Blob([lines.join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agents-${CURRENT_REGION}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $('#agRegionFilter')?.addEventListener('change', async (e) => {
    CURRENT_REGION = e.target.value;
    await refreshAgents();
  });
}

// ——— Entrée publique ———
export async function initAgentsUI() {
  // Détecte si l’onglet existe
  const host = document.getElementById('tab-Agents');
  if (!host) return;

  // valeur de départ pour CURRENT_REGION : si un sélecteur existait avant, on prend sa valeur
  CURRENT_REGION = REGIONS.includes(window.ROMAN?.store?.region) ? window.ROMAN.store.region : 'Europe';

  buildAgentsSectionRoot();
  wireAgentsUI();
  await refreshAgents();
}

// Auto-init si on est sur la page et que l’onglet est visible au chargement
document.addEventListener('DOMContentLoaded', () => {
  const elTab = document.getElementById('tab-Agents');
  if (elTab && elTab.style.display !== 'none') {
    initAgentsUI();
  }
});
