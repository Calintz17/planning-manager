// assets/js/agents.js
// Roster (présence & PTO) + Skills Matrix
import { ROMAN } from './store.js';

const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// Tâches : depuis S.tasks si dispo, sinon fallback
const FALLBACK_TASKS = [
  'Email','Call','Clienteling','Chat','DELIVERY','DELIVERY ISSUE/DELAY','DELIVERY OPEN INVESTIGATION','DELIVERY RETURN TO SENDER','DOC','FRAUD','PAYMENT','PAYMENT NOT CAPTURED','REFUNDS','REFUNDS STATUT','REPAIR','RETURN','RETURN IN STORE','RETURN KO','SHORT SHIPMENT'
];
function getTaskNames(){
  const S = ROMAN.store;
  return (Array.isArray(S.tasks) && S.tasks.length) ? S.tasks.map(t=>t.name) : FALLBACK_TASKS;
}

// Normalisation de la structure agent
function normalizeAgent(a){
  const tasks = getTaskNames();
  if(!a.id) a.id = 'ag_'+Math.random().toString(36).slice(2,8);
  if(!a.name) a.name = 'New Agent';
  if(!a.region || !REGIONS.includes(a.region)) a.region = 'Europe';
  if(!Array.isArray(a.present) || a.present.length!==7) a.present = [true,true,true,true,true,false,false];
  if(!Array.isArray(a.pto) || a.pto.length!==7) a.pto = [false,false,false,false,false,false,false];
  if(!a.skills) a.skills = {};
  for(const t of tasks){ if(typeof a.skills[t] !== 'boolean') a.skills[t] = true; }
  // purge anciennes clés de tâches supprimées
  for(const k of Object.keys(a.skills)){ if(!tasks.includes(k)) delete a.skills[k]; }
  return a;
}

function el(tag, attrs={}, html){
  const e = document.createElement(tag);
  for(const k in attrs) e.setAttribute(k, attrs[k]);
  if(html!==undefined) e.innerHTML = html;
  return e;
}

// ---------- ROSTER ----------
function renderRoster(){
  const S = ROMAN.store;
  const tbody = document.querySelector('#agRoster tbody');
  if(!tbody) return;
  tbody.innerHTML = '';

  const frag = document.createDocumentFragment();

  S.agents.forEach((ag, idx)=>{
    normalizeAgent(ag);

    const tr = el('tr');

    // Name
    const tdName = el('td');
    const inpName = el('input', { class:'input', value:ag.name });
    inpName.addEventListener('input', ()=> { ag.name = inpName.value; renderSkillsBody(); });
    tdName.appendChild(inpName); tr.appendChild(tdName);

    // Region
    const tdRegion = el('td');
    const selRegion = el('select', { class:'input' });
    REGIONS.forEach(r=>{
      const opt = el('option'); opt.value=r; opt.textContent=r; if(r===ag.region) opt.selected=true;
      selRegion.appendChild(opt);
    });
    selRegion.addEventListener('change', ()=> ag.region = selRegion.value);
    tdRegion.appendChild(selRegion); tr.appendChild(tdRegion);

    // Template quick set
    const tdTpl = el('td');
    const selTpl = el('select', { class:'input' });
    ['Custom','Mon–Fri','All Week','Weekend only','None'].forEach(v=>{
      const opt = el('option'); opt.value=v; opt.textContent=v; selTpl.appendChild(opt);
    });
    selTpl.addEventListener('change', ()=>{
      const v = selTpl.value;
      if(v==='Mon–Fri') ag.present = [true,true,true,true,true,false,false];
      else if(v==='All Week') ag.present = [true,true,true,true,true,true,true];
      else if(v==='Weekend only') ag.present = [false,false,false,false,false,true,true];
      else if(v==='None') ag.present = [false,false,false,false,false,false,false];
      renderRoster(); // re-peint juste la table roster
    });
    tdTpl.appendChild(selTpl); tr.appendChild(tdTpl);

    // Present Mon..Sun
    DAYS.forEach((_, di)=>{
      const td = el('td');
      const chk = el('input', { type:'checkbox' }); chk.checked = !!ag.present[di];
      chk.addEventListener('change', ()=> ag.present[di] = chk.checked);
      td.appendChild(chk); tr.appendChild(td);
    });

    // PTO Mon..Sun
    DAYS.forEach((_, di)=>{
      const td = el('td', { class:'mono' });
      const chk = el('input', { type:'checkbox' }); chk.checked = !!ag.pto[di];
      chk.addEventListener('change', ()=> ag.pto[di] = chk.checked);
      td.appendChild(chk); tr.appendChild(td);
    });

    // Delete
    const tdDel = el('td');
    const btnDel = el('button', { class:'btn ghost' }, 'Delete');
    btnDel.addEventListener('click', ()=>{
      S.agents.splice(idx,1);
      renderAll();
    });
    tdDel.appendChild(btnDel); tr.appendChild(tdDel);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
  updateAgentCount();
}

function updateAgentCount(){
  const S = ROMAN.store;
  const badge = document.getElementById('agCount');
  if(badge) badge.textContent = `${S.agents.length} agents`;
}

// ---------- SKILLS ----------
function renderSkillsHead(){
  const head = document.getElementById('agSkillsHead');
  if(!head) return;
  const tasks = getTaskNames();
  head.innerHTML = '<th>Agent</th>' + tasks.map(t=>`<th>${t}</th>`).join('') + '<th>All / None</th>';
}

function renderSkillsBody(){
  const S = ROMAN.store;
  const tbody = document.getElementById('agSkillsBody');
  if(!tbody) return;

  const tasks = getTaskNames();
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();

  S.agents.forEach((ag)=>{
    normalizeAgent(ag);
    const tr = el('tr');
    const tdName = el('td'); tdName.textContent = ag.name; tr.appendChild(tdName);

    tasks.forEach(task=>{
      const td = el('td', { class:'mono' });
      const chk = el('input', { type:'checkbox' }); chk.checked = !!ag.skills[task];
      chk.addEventListener('change', ()=> ag.skills[task] = chk.checked);
      td.appendChild(chk); tr.appendChild(td);
    });

    const tdAll = el('td');
    const row = el('div', { class:'row' }); row.style.gap='6px';
    const bAll = el('button', { class:'btn ghost' }, 'All');
    const bNone = el('button', { class:'btn ghost' }, 'None');
    bAll.addEventListener('click', ()=>{
      for(const t of tasks) ag.skills[t] = true; renderSkillsBody();
    });
    bNone.addEventListener('click', ()=>{
      for(const t of tasks) ag.skills[t] = false; renderSkillsBody();
    });
    row.appendChild(bAll); row.appendChild(bNone);
    tdAll.appendChild(row); tr.appendChild(tdAll);

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

// ---------- ACTIONS ----------
function addAgent(){
  const S = ROMAN.store;
  const a = normalizeAgent({ name:'New Agent', region: 'Europe' });
  S.agents.push(a);
  renderAll();
}

function resetSample(){
  const S = ROMAN.store;
  S.agents = [
    normalizeAgent({ id:'a1', name:'Alex Martin', region:'Europe' }),
    normalizeAgent({ id:'a2', name:'Jamie Lee', region:'Europe' })
  ];
  renderAll();
}

function exportAgentsCSV(){
  const S = ROMAN.store;
  const tasks = getTaskNames();
  const headers = [
    'name','region',
    ...DAYS.map(d=>'present_'+d.toLowerCase()),
    ...DAYS.map(d=>'pto_'+d.toLowerCase()),
    ...tasks.map(t=>'skill_'+t.replace(/\s+/g,'_').toLowerCase())
  ];
  const lines = [headers.join(',')];

  for(const ag of S.agents){
    normalizeAgent(ag);
    const row = [
      JSON.stringify(ag.name),
      JSON.stringify(ag.region),
      ...ag.present.map(v=>v?1:0),
      ...ag.pto.map(v=>v?1:0),
      ...tasks.map(t => ag.skills[t]?1:0)
    ];
    lines.push(row.join(','));
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roman-agents.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- PUBLIC INIT ----------
export function initAgents(){
  // Wire boutons
  document.getElementById('agAdd')?.addEventListener('click', addAgent);
  document.getElementById('agReset')?.addEventListener('click', resetSample);
  document.getElementById('agExport')?.addEventListener('click', exportAgentsCSV);

  // Premier rendu
  renderRoster();
  renderSkillsHead();
  renderSkillsBody();
}
