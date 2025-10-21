// assets/js/agents.js
import { supabase, ROMAN } from './store.js';

const SKILLS = [
  'Call','Mail','Chat','Clienteling','Fraud',
  'Back Office','Lunch Break','Break','Morning Brief','Training'
];

// Helpers --------------------------------------------------------------------
function ensureSkillsShape(s) {
  const obj = typeof s === 'object' && s !== null ? { ...s } : {};
  for (const k of SKILLS) if (typeof obj[k] !== 'boolean') obj[k] = true;
  // supprime d’éventuelles anciennes clés
  for (const k of Object.keys(obj)) if (!SKILLS.includes(k)) delete obj[k];
  return obj;
}

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

// Rendu ----------------------------------------------------------------------
function buildTableSkeleton(){
  // Le markup attendu :
  // <section id="tab-Agents"> ... <table id="agentsTable"><thead>... (déjà présent) ...</thead><tbody id="agentsTbody"></tbody></table>
  // Si ton HTML n’a pas encore ces id, on les ajoute sans tout casser.
  const section = qs('#tab-Agents');
  if (!section) return;

  // cherche un tableau : prend le premier dans la section
  let table = section.querySelector('table#agentsTable');
  if (!table) {
    table = section.querySelector('table') || document.createElement('table');
    table.id = 'agentsTable';
    if (!table.parentElement) {
      const card = document.createElement('div');
      card.className = 'card';
      card.appendChild(table);
      section.appendChild(card);
    }
  }

  // Assure le <tbody>
  let tbody = table.querySelector('tbody#agentsTbody');
  if (!tbody) {
    tbody = document.createElement('tbody');
    tbody.id = 'agentsTbody';
    table.appendChild(tbody);
  }

  // Si pas de thead, on en pose un (colonnes standards)
  if (!table.querySelector('thead')) {
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');
    tr.innerHTML = [
      '<th>Agent</th>',
      ...SKILLS.map(s => `<th class="rot">${s}</th>`),
      '<th>PTO</th>',
      '<th>Calendar</th>',
      '<th>Delete</th>',
    ].join('');
    thead.appendChild(tr);
    table.insertAdjacentElement('afterbegin', thead);
  }
}

function renderRows(agents){
  const tbody = qs('#agentsTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const frag = document.createDocumentFragment();

  for (const a of agents){
    const tr = document.createElement('tr');

    // 1) Nom (éditable)
    const tdName = document.createElement('td');
    const inp = document.createElement('input');
    inp.className = 'input';
    inp.value = a.full_name || '';
    inp.placeholder = 'Full name';
    inp.addEventListener('change', async () => {
      const { error } = await supabase
        .from('agents')
        .update({ full_name: inp.value })
        .eq('id', a.id);
      if (error) alert('Update name failed: ' + error.message);
    });
    tdName.appendChild(inp);
    tr.appendChild(tdName);

    // 2) Skills (checkbox par skill)
    const skills = ensureSkillsShape(a.skills);
    for (const s of SKILLS){
      const td = document.createElement('td'); td.className = 'mono';
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = !!skills[s];
      chk.addEventListener('change', async ()=>{
        skills[s] = chk.checked;
        const { error } = await supabase
          .from('agents')
          .update({ skills })
          .eq('id', a.id);
        if (error) {
          alert('Update skills failed: ' + error.message);
          chk.checked = !chk.checked; // revert
        }
      });
      td.appendChild(chk);
      tr.appendChild(td);
    }

    // 3) PTO bouton (panneau latéral à venir)
    const tdPto = document.createElement('td');
    const bPto = document.createElement('button');
    bPto.className = 'btn ghost';
    bPto.textContent = 'PTO';
    bPto.title = 'Declare PTO (side panel – coming next)';
    // TODO: ouvrira un panneau latéral (prochaine brique)
    tdPto.appendChild(bPto);
    tr.appendChild(tdPto);

    // 4) Calendar bouton (aperçu PTO – à venir)
    const tdCal = document.createElement('td');
    const bCal = document.createElement('button');
    bCal.className = 'btn ghost';
    bCal.textContent = 'Open';
    bCal.title = 'Open PTO calendar (coming next)';
    tdCal.appendChild(bCal);
    tr.appendChild(tdCal);

    // 5) Delete
    const tdDel = document.createElement('td');
    const bDel = document.createElement('button');
    bDel.className = 'btn ghost';
    bDel.textContent = 'Delete';
    bDel.addEventListener('click', async ()=>{
      if (!confirm(`Delete ${a.full_name}?`)) return;
      const { error } = await supabase.from('agents').delete().eq('id', a.id);
      if (error) return alert('Delete failed: ' + error.message);
      loadAndRender(); // refresh
    });
    tdDel.appendChild(bDel);
    tr.appendChild(tdDel);

    frag.appendChild(tr);
  }

  tbody.appendChild(frag);
  const badge = qs('#agCount');
  if (badge) badge.textContent = `${agents.length} agents`;
}

// Data -----------------------------------------------------------------------
async function fetchAgents(region){
  // Important: on filtre par region pour l’affichage
  const { data, error } = await supabase
    .from('agents')
    .select('id, full_name, region, skills, active')
    .eq('region', region)
    .order('full_name', { ascending: true });

  if (error) {
    console.warn('[agents] select error', error);
    return [];
  }
  // normalise skills pour l’UI
  return (data || []).map(a => ({ ...a, skills: ensureSkillsShape(a.skills) }));
}

async function addAgent(region){
  const full_name = prompt('Agent full name?');
  if (!full_name) return;
  const emptySkills = ensureSkillsShape({});
  const { error } = await supabase
    .from('agents')
    .insert([{ full_name, region, skills: emptySkills, active: true }]);
  if (error) alert('Insert failed: ' + error.message);
  await loadAndRender();
}

async function loadAndRender(){
  buildTableSkeleton();
  const regionSel = qs('#agRegionSel');
  const region = regionSel ? regionSel.value : 'Europe';
  const rows = await fetchAgents(region);
  renderRows(rows);
}

// Wiring ---------------------------------------------------------------------
export async function initAgents(){
  buildTableSkeleton();

  // Assure que le select Region a un id stable
  const sel = document.querySelector('#tab-Agents select, #agRegionSel');
  if (sel && !sel.id) sel.id = 'agRegionSel';

  const regionSel = qs('#agRegionSel');
  if (regionSel) regionSel.addEventListener('change', loadAndRender);

  // Add
  const addBtn = qs('#tab-Agents #agAdd, #tab-Agents [id="agAdd"], #tab-Agents button.btn');
  // Si ton bouton “Add agent” n’a pas d’id, pose-en un
  if (addBtn && !addBtn.id) addBtn.id = 'agAdd';
  const btn = qs('#agAdd');
  if (btn) btn.onclick = () => addAgent(regionSel ? regionSel.value : 'Europe');

  // Export
  const exportBtn = qs('#tab-Agents #agExport, #tab-Agents [id="agExport"]');
  if (exportBtn) exportBtn.onclick = async ()=>{
    const region = regionSel ? regionSel.value : 'Europe';
    const list = await fetchAgents(region);
    const headers = ['full_name','region', ...SKILLS.map(s=>'skill_'+s.replace(/\s+/g,'_').toLowerCase())];
    const lines = [headers.join(',')];
    for (const a of list){
      lines.push([
        JSON.stringify(a.full_name), JSON.stringify(a.region),
        ...SKILLS.map(s => a.skills?.[s] ? 1 : 0)
      ].join(','));
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `agents_${region}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  await loadAndRender();
}

