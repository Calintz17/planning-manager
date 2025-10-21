// assets/js/attendance.js
// Vue "Attendance" : 4 semaines glissantes, calcul du besoin/jour et adhérence

import { ROMAN } from './store.js';

// Couleurs progress bar / cases présence
const COLOR_PRIMARY = '#0299FD';
const COLOR_BG_LIGHT = '#CCE4F7';

function ensureStyle() {
  if (document.getElementById('attendance-style')) return;
  const s = document.createElement('style');
  s.id = 'attendance-style';
  s.textContent = `
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

  .attendance-wrap{
    border:1px solid var(--border); border-radius:12px; background:#fff;
    overflow:auto; -webkit-overflow-scrolling:touch;
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
  }
  #attendanceGrid .head{ position:sticky; top:0; background:#fafafa; z-index:2; font-weight:600; }
  #attendanceGrid .row-label{ position:sticky; left:0; background:#fafafa; z-index:1; border-right:1px solid var(--border); }
  #attendanceGrid .present{ background:${COLOR_BG_LIGHT}; }
  #attendanceGrid .need{ color:#555; font-size:11px; }
  `;
  document.head.appendChild(s);
}

// ---------- Utilitaires date ----------
function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d, n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function formatISO(date){ return date.toISOString().slice(0,10); }
function isoWeek(date){
  // ISO week number (1..53)
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return weekNo; // 1..53
}
function isoWeekLabel(date){ return 'w' + String(isoWeek(date)).padStart(2,'0'); }
function weekdayIdx(date){ // 0=Mon..6=Sun
  let n = date.getDay(); // 0 Sun..6 Sat
  return (n===0)?6:(n-1);
}

// ---------- Calcul besoin agents ----------
function averageAHTMin(region){
  const S = ROMAN.store;
  const tasks = S.tasks || [];
  const split = S.forecast?.taskSplit?.[region] || [];
  if (!tasks.length || !split.length) return 10; // fallback

  // split et tasks doivent être alignés par nom (on mappe par nom)
  const mapAHT = Object.fromEntries(tasks.map(t => [t.name, t.aht || 10]));
  const names = tasks.map(t => t.name);
  let sum = 0;
  for (let i=0;i<names.length;i++){
    const name = names[i];
    const pct = split[i] || 0;
    sum += (mapAHT[name] || 10) * (pct/100);
  }
  return sum || 10;
}

function daySharePct(region, date){
  const S = ROMAN.store;
  const hourlyRows = S.forecast?.hourly?.[region] || [];
  const dayLabels = ['1-Monday','2-Tuesday','3-Wednesday','4-Thursday','5-Friday','6-Saturday','7-Sunday'];
  const row = hourlyRows[weekdayIdx(date)] || '';
  const parts = String(row).split('\t');
  const val = parts[1] || '0';
  return parseFloat(String(val).replace(',','.')) || 0;
}

function weekPct(region, date){
  const S = ROMAN.store;
  const keyByRegion = { 'Europe':'EU','Americas':'US','Greater China':'CN','Japan':'JP','South Korea':'KR','SEAO':'SEAO' };
  const key = keyByRegion[region];
  const week = isoWeek(date); // 1..53
  const row = S.forecast?.weekly?.[key] || [];
  const val = row[week-1] || '0';
  return parseFloat(String(val).replace(',','.')) || 0;
}

function requiredAgentsForDate(region, date){
  const S = ROMAN.store;
  const total = Number(S.forecast?.totals?.[region] || 0); // total annuel → ici on considère “par 52 semaines” => weekly%
  if (!total) return 0;

  const wPct = weekPct(region, date) / 100;
  const dPct = daySharePct(region, date) / 100;
  const aht = averageAHTMin(region);      // minutes par item
  const effPerAgentMin = 8 * 60;          // hypothèse simple : 8h net/jour/agent

  const dayVolume = total * wPct * dPct;  // items du jour
  const minutesNeeded = dayVolume * aht;  // minutes de travail
  const agents = Math.ceil(minutesNeeded / effPerAgentMin);
  return agents;
}

// ---------- Planification simple ----------
function buildAttendancePlan(region, startDate, days=28){
  const S = ROMAN.store;
  const dates = Array.from({length:days}, (_,i)=> startOfDay(addDays(startDate, i)));
  const agents = (S.agents || []).filter(a => a.region === region);
  // Normalise flags present[] et pto[]
  agents.forEach(a=>{
    if(!Array.isArray(a.present) || a.present.length!==7) a.present = [true,true,true,true,true,false,false];
    if(!Array.isArray(a.pto) || a.pto.length!==7) a.pto = [false,false,false,false,false,false,false];
  });

  // Plan : pour chaque date, on choisit les N premiers agents disponibles (présence=oui & pto=non), en tournant pour équilibrer.
  const plan = {}; // plan[isoDate] = { required, chosenIds:[] }
  let offset = 0;
  dates.forEach((d)=>{
    const need = requiredAgentsForDate(region, d);
    const w = weekdayIdx(d);
    const available = agents.filter(a => a.present[w] && !a.pto[w]);
    // rotation simple
    const rotated = available.slice(offset).concat(available.slice(0, offset));
    const chosen = rotated.slice(0, need).map(a => a.id);
    plan[formatISO(d)] = { required: need, chosenIds: chosen };
    offset = (offset + need) % Math.max(1, available.length);
  });

  return { dates, agents, plan };
}

// ---------- Rendu ----------
function renderGrid(region, startDate){
  ensureStyle();

  // Si pas d'agents Europe côté store, on injecte les 12 par défaut (usage local / GitHub Pages)
  if ((ROMAN.store.agents || []).filter(a=>a.region==='Europe').length === 0){
    const seed = [
      'Silvia Pons','Naomi Nganzami','Julien Bidau','Safia Benmokhtar','Elisabeth Ngouallou',
      'Duncan Sheffield','Pierluigi Vazza','Simone Geissler','Leander Vogel','Brice Beauvois',
      'Olivia Cafagna','Stéphane Rizzo'
    ];
    ROMAN.store.agents = ROMAN.store.agents || [];
    seed.forEach(n=>{
      ROMAN.store.agents.push({
        id: 'ag_'+Math.random().toString(36).slice(2,8),
        name:n, region:'Europe',
        present:[true,true,true,true,true,false,false],
        pto:[false,false,false,false,false,false,false]
      });
    });
  }

  const { dates, agents, plan } = buildAttendancePlan(region, startDate, 28);

  // KPIs
  let sumNeed = 0, sumHave = 0;
  dates.forEach(d=>{
    const k = formatISO(d);
    sumNeed += plan[k].required;
    sumHave += (plan[k].chosenIds.length || 0);
  });
  const adherence = (sumNeed>0) ? Math.min(100, (sumHave/sumNeed)*100) : 100;

  // Progress bar
  const fill = document.getElementById('attProgressFill');
  const lab  = document.getElementById('attProgressLabel');
  if (fill) fill.style.width = adherence.toFixed(0) + '%';
  if (lab)  lab.textContent = adherence.toFixed(0) + '%';

  // Build grid
  const host = document.getElementById('attendanceGrid');
  if (!host) return;
  const cols = 1 + dates.length;
  host.style.gridTemplateColumns = `200px repeat(${dates.length}, minmax(80px, 1fr))`;
  host.innerHTML = '';

  // Head
  for (let c=0;c<cols;c++){
    const cell = document.createElement('div');
    cell.className = 'cell head' + (c===0 ? ' row-label' : '');
    if (c===0) cell.textContent = 'Agent';
    else {
      const d = dates[c-1];
      const k = formatISO(d);
      const need = plan[k].required;
      const dd = d.toLocaleDateString(undefined,{ weekday:'short', day:'2-digit', month:'2-digit'});
      cell.innerHTML = `${dd} <span class="need">(need ${need})</span>`;
    }
    host.appendChild(cell);
  }

  // Rows
  agents.forEach(a=>{
    for (let c=0;c<cols;c++){
      const cell = document.createElement('div');
      cell.className = 'cell' + (c===0 ? ' row-label' : '');
      if (c===0){
        cell.textContent = a.name;
      } else {
        const d = dates[c-1];
        const k = formatISO(d);
        const chosen = plan[k].chosenIds;
        if (chosen.includes(a.id)){
          cell.classList.add('present');
          cell.textContent = 'Present';
        } else {
          cell.textContent = '';
        }
      }
      host.appendChild(cell);
    }
  });
}

export function initAttendance(){
  ensureStyle();

  // Valeurs par défaut (start = aujourd’hui)
  const startInp = document.getElementById('attStart');
  const regionSel = document.getElementById('attRegion');
  if (startInp && !startInp.value){
    const today = new Date();
    startInp.value = formatISO(today);
  }
  if (regionSel) regionSel.value = ROMAN.store.region || 'Europe';

  const run = ()=>{
    const region = (regionSel?.value) || 'Europe';
    const startD = startOfDay(new Date(startInp?.value || new Date()));
    ROMAN.store.region = region; // garder aligné avec le reste
    renderGrid(region, startD);
  };

  document.getElementById('attRecalc')?.addEventListener('click', run);
  regionSel?.addEventListener('change', run);
  startInp?.addEventListener('change', run);

  run();
}
