// assets/js/forecast.js
// Collapse des anciennes micro-tâches -> 10 nouvelles catégories + UI Forecast inchangée

import { ROMAN } from './store.js';
import { LEGACY_MICROTASKS_AHT, getNewTaskCatalog } from './tasks.js';

const REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];

// Index legacy (ordre d'origine)
const LEGACY_ORDER = [
  'Email','Call','Clienteling','Chat',
  'DELIVERY','DELIVERY ISSUE/DELAY','DELIVERY OPEN INVESTIGATION','DELIVERY RETURN TO SENDER',
  'DOC','FRAUD','PAYMENT','PAYMENT NOT CAPTURED','REFUNDS','REFUNDS STATUT','REPAIR',
  'RETURN','RETURN IN STORE','RETURN KO','SHORT SHIPMENT'
];
const BO_KEYS = [
  'DELIVERY','DELIVERY ISSUE/DELAY','DELIVERY OPEN INVESTIGATION','DELIVERY RETURN TO SENDER',
  'DOC','PAYMENT','PAYMENT NOT CAPTURED','REFUNDS','REFUNDS STATUT','REPAIR','RETURN',
  'RETURN IN STORE','RETURN KO','SHORT SHIPMENT'
];

// Transforme un row legacy[19] -> new[10]
function collapseRowToNew(row19){
  const v = (i)=> Number(String(row19[i]).toString().replace(',','.')) || 0;
  const obj = {};
  LEGACY_ORDER.forEach((name, i)=> obj[name] = v(i));

  const call = obj['Call'];
  const mail = obj['Email'];
  const chat = obj['Chat'];
  const clienteling = obj['Clienteling'];
  const fraud = obj['FRAUD'];
  let backOffice = 0;
  for (const k of BO_KEYS) backOffice += (obj[k]||0);

  const new10 = [
    call, mail, chat, clienteling, fraud, backOffice,
    0, 0, 0, 0 // Lunch, Break, Morning Brief, Training
  ];

  // normalise léger si arrondis
  const sum = new10.reduce((a,b)=>a+b,0);
  if (sum > 0 && Math.abs(sum-100) > 0.01){
    const f = 100/sum;
    return new10.map(x=> +(x*f).toFixed(2));
  }
  return new10.map(x=> +(+x).toFixed(2));
}

// Construit des poids BackOffice par région (pour AHT pondéré)
function buildBackOfficeWeightsPerRegion(taskSplitLegacy){
  // taskSplitLegacy: { region: number[19] }
  const weights = {};
  for (const r of REGIONS){
    const row = taskSplitLegacy[r] || Array(19).fill(0);
    const obj = {}; LEGACY_ORDER.forEach((name,i)=> obj[name]= Number(String(row[i]).toString().replace(',','.')) || 0);
    let boSum = 0; for (const k of BO_KEYS) boSum += obj[k]||0;
    const w = {};
    if (boSum > 0){
      for (const k of BO_KEYS) w[k] = (obj[k]||0) / boSum;
    } else {
      // pas de BO -> repartir égal
      const eq = 1/BO_KEYS.length;
      for (const k of BO_KEYS) w[k] = eq;
    }
    weights[r] = w;
  }
  return weights; // { region: { microTask: weight } }
}

function ahtBackOfficeForRegion(region, weights){
  // moyenne pondérée des AHT micro-tâches
  const w = (weights && weights[region]) || {};
  let sum = 0;
  for (const k of BO_KEYS){
    const aht = LEGACY_MICROTASKS_AHT[k] || 10;
    const p = w[k] || 0;
    sum += aht * p;
  }
  return Math.round(sum * 10) / 10;
}

// -------- UI builders (identique en structure, mais en-têtes = 10 tâches) --------

const TASKS_NEW = ['Call','Mail','Chat','Clienteling','Fraud','Back Office','Lunch Break','Break','Morning Brief','Training'];
const HOURS = ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00','20:30','21:00'];
const DAYS = ['1-Monday','2-Tuesday','3-Wednesday','4-Thursday','5-Friday','6-Saturday','7-Sunday'];

const pctToNumber = str => parseFloat(String(str).replace('%','').replace(',','.')) || 0;
const num = v => parseFloat(String(v).replace(',','.')) || 0;

function setBadge(cell, value, tol=0.1){
  const diff = Math.abs(value-100);
  const klass = (diff<=tol) ? 'ok' : (value>100?'err':'warn');
  cell.innerHTML = `<span class="badge ${klass}">${value.toFixed(1)}%</span>`;
}

// ====== INIT / COLLAPSE ======
export function initForecast(){
  const S = ROMAN.store;
  if (!S.forecast){ S.forecast = {}; }

  // 1) si pas de forecast, charger defaults (reprend ton existant via store déjà initialisé dans l’app)
  // (on suppose que S.forecast.* sont déjà présents grâce à l’init précédente ; sinon, app charge les defaults)

  // 2) Construire poids BackOffice par région depuis l'ancien split (si dispo)
  if (S.forecast.taskSplit && !S.forecast.backOfficeWeights){
    S.forecast.backOfficeWeights = buildBackOfficeWeightsPerRegion(S.forecast.taskSplit);
  }

  // 3) Effondrer le split legacy -> nouveau split (10 colonnes)
  if (S.forecast.taskSplit){
    const collapsed = {};
    for (const r of REGIONS){
      const row19 = S.forecast.taskSplit[r] || Array(19).fill(0);
      collapsed[r] = collapseRowToNew(row19);
    }
    S.forecast.taskSplitNew = collapsed; // on garde à part
  }

  // 4) Ajuster AHT Back Office par région => met à jour le catalogue pour info UI
  const tasks = getNewTaskCatalog();
  const idxBO = tasks.findIndex(t=>t.name==='Back Office');
  if (idxBO >= 0 && S.forecast.backOfficeWeights){
    // on fixe un AHT "global" par défaut (Europe) pour l’UI; l’optimizer calculera par région
    tasks[idxBO].aht = ahtBackOfficeForRegion('Europe', S.forecast.backOfficeWeights);
  }

  // Peindre l’UI (totaux/weekly/hourly) comme avant mais avec TASKS_NEW en colonnes
  buildTotals();
  buildTaskSplit();
  buildWeekly();
  buildHourly();
  wireInputs();
  recalcAllBadges();
}

// ====== UI ======
function buildTotals(){
  const tbody = document.querySelector('#fcRegionTotals tbody'); if(!tbody) return;
  const F = ROMAN.store.forecast;
  tbody.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(const r of REGIONS){
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${r}</td>
      <td><input class="input mono" data-fc="total" data-region="${r}" value="${F.totals?.[r] ?? 0}"/></td>
      <td class="mono" id="fcTaskSum-${r}"></td>
    `;
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function buildTaskSplit(){
  const head = document.getElementById('fcTaskSplitHead');
  const body = document.getElementById('fcTaskSplitBody');
  const F = ROMAN.store.forecast;
  head.innerHTML = '<th>Region</th>' + TASKS_NEW.map(t=>`<th>${t}</th>`).join('') + '<th class="mono">Row total</th>';
  body.innerHTML = '';
  const frag = document.createDocumentFragment();

  for(const r of REGIONS){
    const vals = (F.taskSplitNew?.[r]) || Array(TASKS_NEW.length).fill(0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${r}</td>` + vals.map((v,i)=>`
      <td><input class="input mono" data-fc="taskNew" data-region="${r}" data-idx="${i}" value="${String(v).replace('.',',')}"/></td>
    `).join('') + `<td class="mono" id="fcTaskRow-${r}"></td>`;
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}

function buildWeekly(){
  // inchangé (52 semaines x régions)
  const head = document.getElementById('fcWeeklyHead');
  const body = document.getElementById('fcWeeklyBody');
  const F = ROMAN.store.forecast;
  head.innerHTML = '<th>Week</th>' + REGIONS.map(r=>`<th>${r}</th>`).join('') + '<th class="mono">Row total</th>';
  body.innerHTML = '';
  const frag = document.createDocumentFragment();
  for(let i=1;i<=52;i++){
    const w = 'w'+String(i).padStart(2,'0');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${w}</td>` + REGIONS.map((r)=>{
      const key = ({Europe:'EU',Americas:'US','Greater China':'CN',Japan:'JP','South Korea':'KR',SEAO:'SEAO'})[r];
      const def = ROMAN.store.forecast.weekly?.[key]?.[i-1] ?? '0,00';
      return `<td><input class="input mono" data-fc="weekly" data-week="${w}" data-region="${r}" value="${def}"/></td>`;
    }).join('') + `<td class="mono" id="fcWeeklyRow-${w}"></td>`;
    frag.appendChild(tr);
  }
  body.appendChild(frag);
}

function buildHourly(){
  const host = document.getElementById('fcHourlyBlocks'); host.innerHTML = '';
  const F = ROMAN.store.forecast;

  for(const r of REGIONS){
    const card = document.createElement('div'); card.className='card';
    card.innerHTML = `<h4 style="margin:0 0 8px 0">${r}</h4>
      <div class="scroll" style="max-height:420px">
        <table class="sticky-left">
          <thead><tr><th>Day</th><th>Total day %</th>${HOURS.map(h=>`<th>${h}</th>`).join('')}<th class="mono">Row total</th></tr></thead>
          <tbody id="fcHourlyBody-${r}"></tbody>
        </table>
      </div>`;
    host.appendChild(card);

    const tbody = card.querySelector('tbody');
    const rows = F.hourly?.[r] || [];
    const frag = document.createDocumentFragment();
    rows.forEach(raw=>{
      const parts = String(raw).split('\t');
      const dayLabel = parts[0] || '';
      const dayShare = parts[1] || '0';
      const hourVals = parts.slice(2);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${dayLabel}</td>
        <td><input class="input mono" data-fc="dayShare" data-region="${r}" data-day="${dayLabel}" value="${dayShare}"/></td>` +
        hourVals.map((v,idx)=>`<td><input class="input mono" data-fc="hourPct" data-region="${r}" data-day="${dayLabel}" data-idx="${idx}" value="${v}"/></td>`).join('') +
        `<td class="mono" id="fcHourlyRow-${r}-${dayLabel}"></td>`;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }
}

// ====== Interactions / recalcul ======
function wireInputs(){
  document.querySelectorAll('input[data-fc="taskNew"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const r = inp.dataset.region;
      const i = parseInt(inp.dataset.idx,10);
      const v = parseFloat(String(inp.value).replace(',','.')) || 0;
      const row = ROMAN.store.forecast.taskSplitNew[r] || Array(TASKS_NEW.length).fill(0);
      row[i] = v; ROMAN.store.forecast.taskSplitNew[r] = row;
      recalcTaskRows();
    });
  });
  document.querySelectorAll('input[data-fc="weekly"]').forEach(inp=>{
    inp.addEventListener('input', recalcWeeklyRows);
  });
  document.querySelectorAll('input[data-fc="hourPct"], input[data-fc="dayShare"]').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const msg = recalcHourly();
      const el = document.getElementById('fcSummary'); if(el){ el.textContent = msg; el.className='badge'; }
    });
  });
}

function recalcTaskRows(){
  let allOk = true;
  for(const r of REGIONS){
    const inputs = document.querySelectorAll(`input[data-fc="taskNew"][data-region="${r}"]`);
    let s = 0; inputs.forEach(i=> s += pctToNumber(i.value));
    const cell = document.getElementById(`fcTaskRow-${r}`);
    setBadge(cell, s, 0.1);
    const mirror = document.getElementById(`fcTaskSum-${r}`); if (mirror) mirror.innerHTML = cell.innerHTML;
    allOk = allOk && Math.abs(s-100)<=0.1;
  }
  const el = document.getElementById('fcTaskAllOk');
  if(el){
    el.className = 'badge ' + (allOk?'ok':'warn');
    el.textContent = allOk ? 'Tasks rows = 100% ✅' : 'Some rows ≠ 100%';
  }
  return allOk;
}

function recalcWeeklyRows(){
  let ok = true;
  for(let i=1;i<=52;i++){
    const w = 'w'+String(i).padStart(2,'0');
    const inputs = document.querySelectorAll(`input[data-fc="weekly"][data-week="${w}"]`);
    let s = 0; inputs.forEach(inp=> s += pctToNumber(inp.value));
    const cell = document.getElementById(`fcWeeklyRow-${w}`);
    const diff = Math.abs(s-100);
    const klass = (diff<=0.5)?'ok':(s>100?'err':'warn');
    cell.innerHTML = `<span class="badge ${klass}">${s.toFixed(2)}%</span>`;
    ok = ok && diff<=0.5;
  }
  const el = document.getElementById('fcWeeklyOk');
  if(el){
    el.className = 'badge ' + (ok?'ok':'warn');
    el.textContent = ok ? 'Weekly rows ~100% ✅' : 'Some weeks off 100%';
  }
  return ok;
}

function recalcHourly(){
  const summaries = [];
  for(const r of REGIONS){
    let daySum = 0;
    for(const d of DAYS){
      const hoursInputs = document.querySelectorAll(`input[data-fc="hourPct"][data-region="${r}"][data-day="${d}"]`);
      let s = 0; hoursInputs.forEach(i=> s += pctToNumber(i.value));
      const cell = document.getElementById(`fcHourlyRow-${r}-${d}`);
      setBadge(cell, s, 0.5);
      const shareInp = document.querySelector(`input[data-fc="dayShare"][data-region="${r}"][data-day="${d}"]`);
      daySum += pctToNumber(shareInp?.value || 0);
    }
    summaries.push(`${r}: day-shares ${daySum.toFixed(1)}%`);
  }
  return summaries.join(' | ');
}

function recalcAllBadges(){
  const a = recalcTaskRows();
  const b = recalcWeeklyRows();
  const c = recalcHourly();
  const badge = document.getElementById('fcSummary');
  if(badge){
    badge.textContent = `Tasks=${a?'OK':'Check'} | Weekly=${b?'OK':'Check'} | ${c}`;
    badge.className = 'badge ' + ((a&&b)?'ok':'warn');
  }
}

