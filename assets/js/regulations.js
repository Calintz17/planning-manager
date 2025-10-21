// assets/js/regulations.js
import { supabase } from './supabase.js';
import { ROMAN } from './store.js';

const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];

let currentRegion = 'Europe';
let rows = []; // {id, region, rule_key, label, value, notes, enabled, sort_index}
let savingTimer = null;

function q(sel){ return document.querySelector(sel); }
function el(tag, props={}, html){
  const e = document.createElement(tag);
  Object.entries(props).forEach(([k,v])=> e.setAttribute(k, v));
  if (html!==undefined) e.innerHTML = html;
  return e;
}

async function loadRegion(region){
  currentRegion = region;
  // Lire en DB
  const { data, error } = await supabase
    .from('regulations')
    .select('id,region,rule_key,label,value,notes,enabled,sort_index')
    .eq('region', region)
    .order('sort_index', { ascending:true });
  if (error) { console.error('[regulations] load error', error); rows=[]; render(); return; }

  rows = data || [];
  render();
}

function saveSoon(){
  clearTimeout(savingTimer);
  savingTimer = setTimeout(()=> saveAllChangesForRegion(), 400);
}

async function saveAllChangesForRegion(){
  if (!rows.length) return;
  // upsert de toutes les lignes de la région courante
  const payload = rows.map(r=>({
    id: r.id || undefined,
    region: currentRegion,
    rule_key: r.rule_key,
    label: r.label,
    value: String(r.value ?? ''),
    notes: r.notes ?? '',
    enabled: !!r.enabled,
    sort_index: r.sort_index ?? 0
  }));
  const { data, error } = await supabase.from('regulations').upsert(payload).select('id,rule_key');
  if (error) console.error('[regulations] upsert error', error);
}

async function deleteRow(r){
  if (!r?.id) {
    // ligne locale non encore en DB : juste l’enlever
    rows = rows.filter(x => x !== r);
    render();
    return;
  }
  const { error } = await supabase.from('regulations').delete().eq('id', r.id);
  if (error) { console.error('[regulations] delete error', error); return; }
  rows = rows.filter(x => x.id !== r.id);
  render();
}

function render(){
  const tbody = q('#rgTable tbody');
  const count = q('#rgCount');
  if (!tbody) return;

  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  rows.forEach((r, idx)=>{
    const tr = el('tr');

    // Rule (label)
    const tdRule = el('td');
    const inpRule = el('input', { class:'input', value:r.label });
    inpRule.addEventListener('input', ()=>{
      r.label = inpRule.value;
      // si pas de key personnalisée, dérive depuis le label
      r.rule_key ||= slugKeyFromLabel(inpRule.value);
      saveSoon();
    });
    tdRule.appendChild(inpRule);
    tr.appendChild(tdRule);

    // Value
    const tdVal = el('td');
    const inpVal = el('input', { class:'input mono', value:String(r.value ?? '') });
    inpVal.addEventListener('input', ()=>{
      r.value = inpVal.value;
      saveSoon();
    });
    tdVal.appendChild(inpVal);
    tr.appendChild(tdVal);

    // Notes
    const tdNotes = el('td');
    const inpNotes = el('input', { class:'input', value: r.notes || '' });
    inpNotes.addEventListener('input', ()=>{
      r.notes = inpNotes.value;
      saveSoon();
    });
    tdNotes.appendChild(inpNotes);
    tr.appendChild(tdNotes);

    // Enabled
    const tdEn = el('td', { class:'mono' });
    const chk = el('input', { type:'checkbox' });
    chk.checked = !!r.enabled;
    chk.addEventListener('change', ()=>{
      r.enabled = chk.checked;
      saveSoon();
    });
    tdEn.appendChild(chk);
    tr.appendChild(tdEn);

    // Delete
    const tdDel = el('td');
    const btnDel = el('button', { class:'btn ghost' }, 'Delete');
    btnDel.addEventListener('click', ()=> deleteRow(r));
    tdDel.appendChild(btnDel);
    tr.appendChild(tdDel);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
  if (count) count.textContent = `${rows.length} rules`;
}

function slugKeyFromLabel(s){
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'_')
    .replace(/^_+|_+$/g,'')
    .slice(0,60) || 'rule_' + Math.random().toString(36).slice(2,8);
}

async function addRule(){
  const maxSort = rows.reduce((m, r)=> Math.max(m, r.sort_index||0), 0);
  const r = {
    id: undefined,
    region: currentRegion,
    rule_key: 'custom_' + Math.random().toString(36).slice(2,8),
    label: 'New rule',
    value: '',
    notes: '',
    enabled: true,
    sort_index: maxSort + 10
  };
  rows.push(r);
  render();
  saveSoon();
}

function exportCSV(){
  const headers = ['region','rule_key','label','value','enabled','notes','sort_index'];
  const lines = [headers.join(',')];
  rows.forEach(r=>{
    lines.push([
      JSON.stringify(currentRegion),
      JSON.stringify(r.rule_key),
      JSON.stringify(r.label),
      JSON.stringify(String(r.value ?? '')),
      r.enabled ? '1':'0',
      JSON.stringify(r.notes ?? ''),
      r.sort_index ?? 0
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `roman-regulations-${currentRegion}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function wire(){
  // filtre région (on réutilise #rgFilter déjà dans ton HTML)
  const sel = q('#rgFilter');
  if (sel){
    // s'assurer que les options sont bonnes
    sel.innerHTML = '<option value="ALL" disabled>All regions (view only)</option>' + 
      REGIONS.map(r=>`<option value="${r}">${r}</option>`).join('');
    sel.value = ROMAN.store.region || 'Europe';
    sel.addEventListener('change', ()=>{
      const wanted = sel.value || 'Europe';
      ROMAN.store.region = wanted;
      loadRegion(wanted);
    });
  }

  // boutons
  q('#rgAdd')   ?.addEventListener('click', addRule);
  q('#rgReset') ?.addEventListener('click', async ()=>{
    // recharge DB (les seeds ont déjà été créées ; ici on rappelle juste loadRegion)
    await loadRegion(currentRegion);
  });
  q('#rgExport')?.addEventListener('click', exportCSV);
}

export async function initRegulations(){
  // Adapter l’en-tête du tableau pour n’avoir qu’une seule grille compacte
  const head = document.querySelector('#rgTable thead tr');
  if (head){
    head.innerHTML = `
      <th style="width:28%">Rule</th>
      <th style="width:18%">Value</th>
      <th style="width:34%">Notes</th>
      <th style="width:12%">Enabled</th>
      <th style="width:8%"></th>`;
  }
  wire();
  const startRegion = ROMAN.store.region || 'Europe';
  await loadRegion(startRegion);
}

