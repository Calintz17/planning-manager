// assets/js/tasks.js
// Nouveau catalogue de tâches + utilitaires

import { ROMAN } from './store.js';

// AHT par défaut (minutes) — éditable depuis l'UI Tasks si tu veux
const DEFAULT_TASKS_NEW = [
  { name:'Call',         priority:'P1',        aht:12, enabled:true,  notes:'' },
  { name:'Mail',         priority:'P1',        aht:8,  enabled:true,  notes:'' },
  { name:'Chat',         priority:'P1',        aht:6,  enabled:true,  notes:'' },
  { name:'Clienteling',  priority:'P2',        aht:15, enabled:true,  notes:'' },
  { name:'Fraud',        priority:'Mandatory', aht:20, enabled:true,  notes:'' },
  // Back Office = calcul d'AHT pondéré au runtime (on met une valeur par défaut ici)
  { name:'Back Office',  priority:'P2',        aht:12, enabled:true,  notes:'Auto AHT from micro-tasks' },
  // Ces 4 tâches “temps internes” restent à 0% forecast par défaut
  { name:'Lunch Break',  priority:'Mandatory', aht:60, enabled:false, notes:'' },
  { name:'Break',        priority:'Mandatory', aht:15, enabled:false, notes:'' },
  { name:'Morning Brief',priority:'P3',        aht:20, enabled:false, notes:'' },
  { name:'Training',     priority:'P3',        aht:45, enabled:false, notes:'' },
];

// ancienne (micro) -> utilisée pour calcul AHT Back Office
export const LEGACY_MICROTASKS_AHT = {
  'DELIVERY':10, 'DELIVERY ISSUE/DELAY':12, 'DELIVERY OPEN INVESTIGATION':15, 'DELIVERY RETURN TO SENDER':10,
  'DOC':7, 'PAYMENT':8, 'PAYMENT NOT CAPTURED':10, 'REFUNDS':12, 'REFUNDS STATUT':6,
  'REPAIR':30, 'RETURN':10, 'RETURN IN STORE':8, 'RETURN KO':12, 'SHORT SHIPMENT':15
};

export function getNewTaskCatalog(){
  if (!Array.isArray(ROMAN.store.tasks) || ROMAN.store.tasks.length === 0){
    ROMAN.store.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS_NEW));
  } else {
    // Si un ancien catalogue existe, on remplace par le nouveau (simplification projet)
    ROMAN.store.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS_NEW));
  }
  return ROMAN.store.tasks;
}

// UI rendering (table) — identique à avant mais affiche la nouvelle liste
export function initTasksUI(){
  const S = ROMAN.store;
  if (!S.tasks || !S.tasks.length) getNewTaskCatalog();

  const PRIORITIES = ['Mandatory','P1','P2','P3'];
  const tbody = document.querySelector('#tasksTable tbody');
  const badge = document.getElementById('tasksCountBadge');

  function el(tag, attrs={}, html=''){
    const e = document.createElement(tag);
    for(const k in attrs) e.setAttribute(k, attrs[k]);
    if(html!==undefined) e.innerHTML = html;
    return e;
  }

  function render(){
    if (!tbody) return;
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();

    S.tasks.forEach((t)=>{
      const tr = el('tr');

      const tdName = el('td'); tdName.textContent = t.name; tr.appendChild(tdName);

      const tdPrio = el('td');
      const sel = el('select', { class:'input' });
      PRIORITIES.forEach(p=>{
        const o = el('option'); o.value=p; o.textContent=p; if(p===t.priority) o.selected=true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', ()=> t.priority = sel.value);
      tdPrio.appendChild(sel); tr.appendChild(tdPrio);

      const tdAht = el('td');
      const inp = el('input', { class:'input mono', type:'number', step:'0.5', value:String(t.aht) });
      inp.addEventListener('input', ()=> t.aht = parseFloat(inp.value||'0') || 0);
      tdAht.appendChild(inp); tr.appendChild(tdAht);

      const tdEn = el('td');
      const chk = el('input', { type:'checkbox' }); chk.checked = !!t.enabled;
      chk.addEventListener('change', ()=> t.enabled = chk.checked);
      tdEn.appendChild(chk); tr.appendChild(tdEn);

      const tdNotes = el('td');
      const notes = el('input', { class:'input', value: t.notes||'' });
      notes.addEventListener('input', ()=> t.notes = notes.value);
      tdNotes.appendChild(notes); tr.appendChild(tdNotes);

      frag.appendChild(tr);
    });

    tbody.appendChild(frag);
    if (badge) badge.textContent = `${S.tasks.length} tasks`;
  }

  document.getElementById('btnTasksReset')?.addEventListener('click', ()=>{
    S.tasks = JSON.parse(JSON.stringify(DEFAULT_TASKS_NEW));
    render();
  });
  document.getElementById('btnTasksExport')?.addEventListener('click', ()=>{
    const lines = ['task,priority,aht_min,enabled,notes'];
    for (const t of S.tasks){
      lines.push([JSON.stringify(t.name), t.priority, t.aht, t.enabled?1:0, JSON.stringify(t.notes||'')].join(','));
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roman-tasks.csv'; a.click(); URL.revokeObjectURL(a.href);
  });

  render();
}
