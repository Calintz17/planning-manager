// assets/js/regulations.js
// Onglet "Regulations" : catalogue de règles par région (CRUD simple + export)
import { ROMAN } from './store.js';

const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];

// Règles par défaut (clonées pour chaque région)
const BASE_DEFAULTS = [
  { rule:'Max Hours per Day', value:'8',    notes:'Standard local limit' },
  { rule:'Max Hours per Week', value:'37.5', notes:'Contract weekly limit' },
  { rule:'Legal Max (Exceptional)', value:'48', notes:'Only with special agreements' },
  { rule:'Average Weekly Max (12 weeks)', value:'44', notes:'Rolling average' },
  { rule:'Min Break per Day', value:'1.5',  notes:'In hours; can be split' },
  { rule:'Max Consecutive Work Hours', value:'6', notes:'Break required after 6h continuous work' },
  { rule:'Min Rest Between Shifts', value:'11', notes:'Hours between end and next start' },
  { rule:'Weekly Rest', value:'24',        notes:'Continuous hours per week' },
  { rule:'Sunday Work', value:'Restricted', notes:'Allowed only with contract exceptions' },
  { rule:'Night Work', value:'22:00–06:00', notes:'Extra rules may apply' },
  { rule:'Lunch Window', value:'12:00–14:00', notes:'Auto-lunch 60 min within the window' }
];

function seedDefaults(){
  const arr = [];
  for (const region of REGIONS){
    for (const base of BASE_DEFAULTS){
      arr.push({
        id: 'rg_'+Math.random().toString(36).slice(2,8),
        region,
        rule: base.rule,
        value: base.value,
        notes: base.notes,
        enabled: true
      });
    }
  }
  return arr;
}

function ensureStore(){
  const S = ROMAN.store;
  if (!Array.isArray(S.regulations) || !S.regulations.length){
    S.regulations = seedDefaults();
  }
}

function el(tag, attrs={}, html){
  const e = document.createElement(tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* ---------- RENDER ---------- */
function render(){
  ensureStore();
  const S = ROMAN.store;
  const tbody = document.querySelector('#rgTable tbody');
  if (!tbody) return;

  const regionFilter = document.getElementById('rgFilter')?.value || 'ALL';
  const rows = S.regulations.filter(r => regionFilter==='ALL' ? true : r.region === regionFilter);

  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  rows.forEach((r)=>{
    const tr = el('tr');

    // Rule
    const tdRule = el('td');
    const inpRule = el('input', { class:'input', value:r.rule });
    inpRule.addEventListener('input', ()=> r.rule = inpRule.value);
    tdRule.appendChild(inpRule); tr.appendChild(tdRule);

    // Region
    const tdRegion = el('td');
    const selRegion = el('select', { class:'input' });
    REGIONS.forEach(reg=>{
      const opt = el('option'); opt.value = reg; opt.textContent = reg; if(reg===r.region) opt.selected = true;
      selRegion.appendChild(opt);
    });
    selRegion.addEventListener('change', ()=> r.region = selRegion.value);
    tdRegion.appendChild(selRegion); tr.appendChild(tdRegion);

    // Value
    const tdValue = el('td');
    const inpVal = el('input', { class:'input mono', value:String(r.value) });
    inpVal.addEventListener('input', ()=> r.value = inpVal.value);
    tdValue.appendChild(inpVal); tr.appendChild(tdValue);

    // Notes
    const tdNotes = el('td');
    const inpNotes = el('input', { class:'input', value:r.notes||'' });
    inpNotes.addEventListener('input', ()=> r.notes = inpNotes.value);
    tdNotes.appendChild(inpNotes); tr.appendChild(tdNotes);

    // Enabled
    const tdEnabled = el('td', { class:'mono' });
    const chk = el('input', { type:'checkbox' }); chk.checked = !!r.enabled;
    chk.addEventListener('change', ()=> r.enabled = chk.checked);
    tdEnabled.appendChild(chk); tr.appendChild(tdEnabled);

    // Delete
    const tdDel = el('td');
    const bDel = el('button', { class:'btn ghost' }, 'Delete');
    bDel.addEventListener('click', ()=>{
      const pos = S.regulations.indexOf(r);
      if (pos>-1) S.regulations.splice(pos,1);
      render(); updateCount();
    });
    tdDel.appendChild(bDel); tr.appendChild(tdDel);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
  updateCount();
}

function updateCount(){
  const badge = document.getElementById('rgCount');
  if (badge) badge.textContent = `${ROMAN.store.regulations.length} rules`;
}

/* ---------- ACTIONS ---------- */
function addRule(){
  const S = ROMAN.store;
  const region = document.getElementById('rgFilter')?.value;
  S.regulations.push({
    id: 'rg_'+Math.random().toString(36).slice(2,8),
    region: (region && region!=='ALL') ? region : 'Europe',
    rule: 'New rule',
    value: '',
    notes: '',
    enabled: true
  });
  render();
}

function resetDefaults(){
  ROMAN.store.regulations = seedDefaults();
  const sel = document.getElementById('rgFilter');
  if (sel) sel.value = 'ALL';
  render();
}

function exportCSV(){
  const lines = ['region,rule,value,enabled,notes'];
  for (const r of ROMAN.store.regulations){
    lines.push([
      JSON.stringify(r.region),
      JSON.stringify(r.rule),
      JSON.stringify(r.value),
      r.enabled ? '1' : '0',
      JSON.stringify(r.notes||'')
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roman-regulations.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- PUBLIC API ---------- */
export function initRegulations(){
  ensureStore();

  // Wire boutons
  document.getElementById('rgAdd')?.addEventListener('click', addRule);
  document.getElementById('rgReset')?.addEventListener('click', resetDefaults);
  document.getElementById('rgExport')?.addEventListener('click', exportCSV);
  document.getElementById('rgFilter')?.addEventListener('change', render);

  // Premier rendu
  render();
}
