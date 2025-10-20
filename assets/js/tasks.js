// assets/js/tasks.js
// Tasks catalog: priority, AHT, enabled, notes
import { ROMAN } from './store.js';

const PRIORITIES = ['Mandatory','P1','P2','P3'];

const DEFAULT_TASKS = [
  { name:'Email', priority:'P1', aht:8,  enabled:true, notes:'' },
  { name:'Call', priority:'P1', aht:12, enabled:true, notes:'' },
  { name:'Clienteling', priority:'P2', aht:15, enabled:true, notes:'' },
  { name:'Chat', priority:'P1', aht:6,  enabled:true, notes:'' },
  { name:'DELIVERY', priority:'P2', aht:10, enabled:true, notes:'' },
  { name:'DELIVERY ISSUE/DELAY', priority:'P2', aht:12, enabled:true, notes:'' },
  { name:'DELIVERY OPEN INVESTIGATION', priority:'P2', aht:15, enabled:true, notes:'' },
  { name:'DELIVERY RETURN TO SENDER', priority:'P2', aht:10, enabled:true, notes:'' },
  { name:'DOC', priority:'P2', aht:7,  enabled:true, notes:'' },
  { name:'FRAUD', priority:'Mandatory', aht:20, enabled:true, notes:'' },
  { name:'PAYMENT', priority:'P1', aht:8,  enabled:true, notes:'' },
  { name:'PAYMENT NOT CAPTURED', priority:'P1', aht:10, enabled:true, notes:'' },
  { name:'REFUNDS', priority:'P1', aht:12, enabled:true, notes:'' },
  { name:'REFUNDS STATUT', priority:'P2', aht:6,  enabled:true, notes:'' },
  { name:'REPAIR', priority:'P2', aht:30, enabled:true, notes:'' },
  { name:'RETURN', priority:'P1', aht:10, enabled:true, notes:'' },
  { name:'RETURN IN STORE', priority:'P1', aht:8,  enabled:true, notes:'' },
  { name:'RETURN KO', priority:'P2', aht:12, enabled:true, notes:'' },
  { name:'SHORT SHIPMENT', priority:'P2', aht:15, enabled:true, notes:'' },
];

function ensureTasks() {
  const S = ROMAN.store;
  if (!Array.isArray(S.tasks) || !S.tasks.length) {
    S.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  } else {
    // normalize: keep known fields only; preserve order
    S.tasks = S.tasks.map(t => ({
      name: String(t.name),
      priority: PRIORITIES.includes(t.priority) ? t.priority : 'P2',
      aht: Number.isFinite(+t.aht) ? +t.aht : 10,
      enabled: !!t.enabled,
      notes: String(t.notes ?? '')
    }));
  }
}

function el(tag, attrs={}, html='') {
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function render() {
  ensureTasks();
  const S = ROMAN.store;
  const tbody = document.querySelector('#tasksTable tbody');
  const badge = document.getElementById('tasksCountBadge');
  if (!tbody) return;

  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  S.tasks.forEach((t, idx) => {
    const tr = el('tr');

    // Name (read-only for MVP — clé stable)
    const tdName = el('td'); tdName.textContent = t.name; tr.appendChild(tdName);

    // Priority
    const tdPrio = el('td');
    const sel = el('select', { class:'input' });
    PRIORITIES.forEach(p => {
      const opt = el('option'); opt.value = p; opt.textContent = p; if (p === t.priority) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', () => {
      t.priority = sel.value;
      notifyTasksUpdated();
    });
    tdPrio.appendChild(sel); tr.appendChild(tdPrio);

    // AHT (min)
    const tdAht = el('td');
    const inpAHT = el('input', { class:'input mono', type:'number', min:'0', step:'0.5', value:String(t.aht) });
    inpAHT.addEventListener('input', () => {
      const v = parseFloat(inpAHT.value || '0');
      t.aht = Number.isFinite(v) ? v : 0;
      // Pas besoin de redessiner, l’optimizer lira la valeur au prochain run
    });
    tdAht.appendChild(inpAHT); tr.appendChild(tdAht);

    // Enabled
    const tdEn = el('td');
    const chk = el('input', { type:'checkbox' }); chk.checked = !!t.enabled;
    chk.addEventListener('change', () => {
      t.enabled = chk.checked;
      notifyTasksUpdated(); // la Skills Matrix peut changer d’étendue
    });
    tdEn.appendChild(chk); tr.appendChild(tdEn);

    // Notes
    const tdNotes = el('td');
    const inpNotes = el('input', { class:'input', type:'text', value: t.notes || '' });
    inpNotes.addEventListener('input', () => { t.notes = inpNotes.value; });
    tdNotes.appendChild(inpNotes); tr.appendChild(tdNotes);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
  if (badge) badge.textContent = `${ROMAN.store.tasks.length} tasks`;
}

function resetDefaults() {
  ROMAN.store.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS));
  render();
  notifyTasksUpdated(true);
}

function exportCSV() {
  const lines = ['task,priority,aht_min,enabled,notes'];
  for (const t of ROMAN.store.tasks) {
    lines.push([
      JSON.stringify(t.name),
      t.priority,
      t.aht,
      t.enabled ? '1' : '0',
      JSON.stringify(t.notes || '')
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roman-tasks.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// Notifie le reste de l’app que les tâches ont changé (Agents doit recalculer la Skills Matrix)
function notifyTasksUpdated(force = false) {
  window.dispatchEvent(new CustomEvent('roman:tasks-updated', { detail: { force } }));
}

export function initTasks() {
  // Wire boutons
  document.getElementById('btnTasksReset')?.addEventListener('click', resetDefaults);
  document.getElementById('btnTasksExport')?.addEventListener('click', exportCSV);

  // Premier rendu
  render();
}
