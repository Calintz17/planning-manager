// assets/js/attendance.js
// Vue "Attendance" : 4 semaines glissantes, KPI Adherence, agents depuis Supabase

import { ROMAN } from './store.js';
import { supabase } from './supabase.js'; // <- doit déjà exister dans ton projet

const COLOR_PRIMARY = '#0299FD';
const COLOR_BG_LIGHT = '#CCE4F7';

function ensureStyle() {
  if (document.getElementById('attendance-style')) return;
  const s = document.createElement('style');
  s.id = 'attendance-style';
  s.textContent = `
  /* Barre KPI */
  .att-progress{
    width:min(720px, 100%);
    height:22px;
    background:${COLOR_BG_LIGHT};
    border-radius:999px;
    position:relative;
    overflow:hidden;
  }
  .att-progress-fill{
    height:100%;
    background:${COLOR_PRIMARY};
    border-radius:999px 0 0 999px;
    transition:width .25s ease;
  }
  .att-progress-label{
    position:absolute; top:50%; right:10px; transform:translateY(-50%);
    font-weight:700; color:${COLOR_PRIMARY};
  }

  /* Grille */
  .attendance-wrap{
    border:1px solid var(--border); border-radius:12px; background:#fff;
    overflow:auto; -webkit-overflow-scrolling:touch;
    position:relative; z-index:1; /* évite qu’un overlay fantôme bloque les clics */
  }
  #attendanceGrid{
    display:grid;
    grid-auto-rows:28px;
    font-size:12px;
    min-width: 820px;
  }
  #attendanceGrid .cell{
    border-top:1px solid var(--border);
    border-left:1px solid var(--border);
    padding:4px 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    background:#fff;
  }
  #attendanceGrid .head{ position:sticky; top:0; background:#fafafa; z-index:2; font-weight:600; }
  #attendanceGrid .row-label{ position:sticky; left:0; background:#fafafa; z-index:3; border-right:1px solid var(--border); }
  #attendanceGrid .present{ background:${COLOR_BG_LIGHT}; }
  #attendanceGrid .need{ color:#555; font-size:11px; }
  `;
  document.head.appendChild(s);
}

/* ---- utilitaires date ---- */
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function formatISO(date){ return date.toISOString().slice(0,10); }
function weekdayIdx(date){ let n=date.getDay(); return (n===0)?6:(n-1); } // 0=Mon..6=Sun
function isoWeek(date){
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

const REGION_KEYS = { 'Europe':'EU','Americas':'US','Greater China':'CN','Japan':'JP','South Korea':'KR','SEAO':'SEAO' };
function pctNum(v){ return parseFloat(String(v).replace(',','.')) || 0; }

function avgAHT(region){
  const S = ROMAN.store;
  const tasks = S.tasks || [];
  const split = S.forecast?.taskSplit?.[region] || [];
  if(!tasks.length || !split.length) return 10;
  let sum = 0;
  for(let i=0;i<tasks.length;i++){
    const aht = tasks[i]?.aht ?? 10;
    const p   = split[i] ?? 0;
    sum += aht * (p/100);
  }
  return sum || 10;
}
function weekPct(region, date){
  const S = ROMAN.store;
  const key = REGION_KEYS[region];
  const arr = S.forecast?.weekly?.[key] || [];
  return pctNum(arr[isoWeek(date)-1] || 0);
}
function daySharePct(region, date){
  const S = ROMAN.store;
  const rows = S.forecast?.hourly?.[region] || [];
  const row = rows[weekdayIdx(date)] || '';
  const parts = String(row).split('\t');
  return pctNum(parts[1] || 0);
}
function neededAgents(region, date){
  const total = Number(ROMAN.store.forecast?.totals?.[region] || 0);
  if(!total) return 0;
  const aht = avgAHT(region);
  const dayVolume = total * (weekPct(region,date)/100) * (daySharePct(region,date)/100);
  const minutesNeeded = dayVolume * aht;
  const effPerAgentMin = 8*60; // hypothèse 8h net
  return Math.ceil(minutesNeeded / effPerAgentMin);
}

/* ---- data agents ---- */
async function getAgents(region){
  // Si Supabase est configuré (URL + key), on lit la table
  try{
    if (supabase) {
      const { data, error } = await supabase
        .from('agents')
        .select('id,name,region,present,pto')
        .eq('region', region)
        .order('name', { ascending: true });
      if (error) throw error;
      if (data && data.length) return data.map(a => ({
        id:a.id, name:a.name, region:a.region,
        present: a.present ?? [true,true,true,true,true,false,false],
        pto: a.pto ?? [false,false,false,false,false,false,false]
      }));
    }
  }catch(e){
    console.warn('[attendance] supabase fallback:', e.message);
  }

  // Fallback local (si aucun agent DB)
  const seedEU = [
    'Silvia Pons','Naomi Nganzami','Julien Bidau','Safia Benmokhtar','Elisabeth Ngouallou',
    'Duncan Sheffield','Pierluigi Vazza','Simone Geissler','Leander Vogel','Brice Beauvois',
    'Olivia Cafagna','Stéphane Rizzo'
  ];
  if (region==='Europe'){
    return seedEU.map(n=>({
      id: 'ag_'+Math.random().toString(36).slice(2,8),
      name:n, region,
      present:[true,true,true,true,true,false,false],
      pto:[false,false,false,false,false,false,false]
    }));
  }
  return [];
}

/* ---- build plan + render ---- */
async function buildAndRender(region, startDate){
  ensureStyle();

  const dates = Array.from({length:28}, (_,i)=> startOfDay(addDays(startDate, i)));
  const agents = await getAgents(region);

  // petit round-robin basique
  const plan = {};
  let rot = 0;
  dates.forEach(d=>{
    const need = neededAgents(region, d);
    const w = weekdayIdx(d);
    const available = agents.filter(a => a.present[w] && !(a.pto?.[w]));
    const rotated = available.slice(rot).concat(available.slice(0,rot));
    const chosen = rotated.slice(0, need).map(a=>a.id);
    plan[formatISO(d)] = { need, chosen };
    rot = available.length ? (rot + need) % available.length : 0;
  });

  // KPI
  let needSum=0, haveSum=0;
  dates.forEach(d=>{ const k=formatISO(d); needSum+=plan[k].need; haveSum+=plan[k].chosen.length; });
  const adh = needSum>0 ? Math.min(100,(haveSum/needSum)*100) : 100;
  const fill = document.getElementById('attProgressFill');
  const lab  = document.getElementById('attProgressLabel');
  if (fill) fill.style.width = adh.toFixed(0)+'%';
  if (lab)  lab.textContent = adh.toFixed(0)+'%';

  // grille
  const host = document.getElementById('attendanceGrid');
  if (!host) return;
  host.innerHTML='';
  const cols = 1 + dates.length;
  host.style.gridTemplateColumns = `200px repeat(${dates.length}, minmax(80px,1fr))`;

  // head
  for(let c=0;c<cols;c++){
    const cell = document.createElement('div');
    cell.className = 'cell head' + (c===0?' row-label':'');
    if (c===0) cell.textContent = 'Agent';
    else {
      const d = dates[c-1], k = formatISO(d), need = plan[k].need;
      const dd = d.toLocaleDateString(undefined,{ weekday:'short', day:'2-digit', month:'2-digit'});
      cell.innerHTML = `${dd} <span class="need">(need ${need})</span>`;
    }
    host.appendChild(cell);
  }

  // rows
  agents.forEach(a=>{
    for(let c=0;c<cols;c++){
      const cell = document.createElement('div');
      cell.className = 'cell' + (c===0?' row-label':'');
      if (c===0) cell.textContent = a.name;
      else {
        const d = dates[c-1], k = formatISO(d);
        if (plan[k].chosen.includes(a.id)){
          cell.classList.add('present');
          cell.textContent = '';
        }
      }
      host.appendChild(cell);
    }
  });
}

/* ---- init ---- */
export function initAttendance(){
  ensureStyle();

  const startInp = document.getElementById('attStart');
  const regionSel = document.getElementById('attRegion');

  if (startInp && !startInp.value) startInp.value = formatISO(new Date());
  if (regionSel) regionSel.value = ROMAN.store.region || 'Europe';

  const run = ()=>{
    const region = regionSel?.value || 'Europe';
    const startD = startOfDay(new Date(startInp?.value || new Date()));
    ROMAN.store.region = region;
    buildAndRender(region, startD);
  };

  document.getElementById('attRecalc')?.addEventListener('click', run);
  regionSel?.addEventListener('change', run);
  startInp?.addEventListener('change', run);

  run();
}
