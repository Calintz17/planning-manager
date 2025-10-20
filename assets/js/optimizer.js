// assets/js/optimizer.js
// Optimizer ajusté pour les 10 tâches (avec Back Office AHT pondéré)

import { ROMAN } from './store.js';
import { LEGACY_MICROTASKS_AHT } from './tasks.js';

const PRIORITY_ORDER = ['Mandatory','P1','P2','P3'];
const SLOT_MINUTES = 30;

function pct(x){ return parseFloat(String(x).replace('%','').replace(',','.')) || 0; }
function toMin(t){ const [h,m]=t.split(':').map(Number); return h*60+m; }
function between(t,a,b){ return t>=a && t<b; }

function tasksByPriorityForRegion(region){
  const list = (ROMAN.store.tasks || []).slice();

  // Ajuste l'AHT Back Office par région à la volée si on a les poids
  const weights = ROMAN.store.forecast?.backOfficeWeights;
  if (weights && Array.isArray(list)){
    const idx = list.findIndex(t=>t.name==='Back Office');
    if (idx>=0){
      // moyenne pondérée des AHT micro-tâches
      const w = weights[region] || {};
      let sum = 0;
      for (const k in LEGACY_MICROTASKS_AHT){
        const aht = LEGACY_MICROTASKS_AHT[k] || 10;
        const p = w[k] || 0;
        sum += aht*p;
      }
      list[idx].aht = Math.max(1, Math.round(sum*10)/10);
    }
  }

  const map = { Mandatory:[], P1:[], P2:[], P3:[] };
  for (const t of list){ if (t.enabled && map[t.priority]) map[t.priority].push(t); }
  return map;
}

function buildAvailability(region){
  const S = ROMAN.store;
  const avail = {};
  for(let d=0; d<7; d++){ avail[d]={}; for(let t=0; t<S.hours.length; t++) avail[d][t]=[]; }

  const lunchStart = toMin('12:00'), lunchEnd = toMin('13:00'); // 60m
  const breakSlots = [ toMin('10:30'), toMin('16:30') ];

  for(const ag of S.agents){
    if (ag.region !== region) continue;
    for (let d=0; d<7; d++){
      const present = Array.isArray(ag.present)? ag.present[d] : (d<5);
      const pto = Array.isArray(ag.pto)? ag.pto[d] : false;
      if(!present || pto) continue;

      for(let t=0; t<S.hours.length; t++){
        const start = toMin(S.hours[t]);
        // on garde la logique auto repas/pauses (pour l’instant)
        if (between(start, lunchStart, lunchEnd)) continue;
        if (breakSlots.includes(start)) continue;
        avail[d][t].push(ag.id);
      }
    }
  }
  return avail;
}

function getForecastInputs(region){
  const S = ROMAN.store;
  const F = S.forecast;
  if(!F) return null;

  const regionKey = ({Europe:'EU',Americas:'US','Greater China':'CN',Japan:'JP','South Korea':'KR',SEAO:'SEAO'})[region];
  const total = F.totals?.[region] ?? 0;

  const w = S.weekISO || 'w01';
  const wIdx = Math.max(0, Math.min(51, parseInt(w.slice(1),10)-1));
  const weekPct = pct(F.weekly?.[regionKey]?.[wIdx] ?? 100);

  // NEW split (10 colonnes)
  const tasksNew = F.taskSplitNew?.[region] || Array(10).fill(0);
  const hourlyRows = (F.hourly?.[region] || []).map(line => String(line).split('\t'));

  return { total, weekPct, tasksNew, hourlyRows };
}

function buildDemand(region){
  const S = ROMAN.store;
  const fx = getForecastInputs(region);
  if(!fx) return null;

  const tasksNames = (S.tasks || []).map(t=>t.name); // 10 noms
  const weeklyVolume = fx.total * (fx.weekPct/100);

  const demandUnits = {};
  for(let d=0; d<7; d++){
    demandUnits[d] = {};
    const row = fx.hourlyRows[d] || [];
    const dayShare = pct(row[1] || 0);
    const dayVolume = weeklyVolume * (dayShare/100);

    let hourPcts = row.slice(2).map(pct);
    if (hourPcts.length < S.hours.length){
      hourPcts = hourPcts.concat(Array(S.hours.length - hourPcts.length).fill(0));
    }
    const sumH = hourPcts.reduce((a,b)=>a+b,0) || 1;
    const norm = hourPcts.map(x => x * (100/sumH));

    for(let tIdx=0; tIdx<S.hours.length; tIdx++){
      const cellShare = norm[tIdx] || 0;
      const slotVolume = dayVolume * (cellShare/100);

      tasksNames.forEach((taskName, i)=>{
        const taskPct = fx.tasksNew[i] || 0; // %
        const taskItems = slotVolume * (taskPct/100);
        // convert items -> demi-heures via AHT
        const task = (S.tasks || []).find(tt=>tt.name===taskName);
        const ahtMin = task?.aht || 10;
        const units = taskItems * (ahtMin / SLOT_MINUTES);
        if(!demandUnits[d][tIdx]) demandUnits[d][tIdx] = {};
        demandUnits[d][tIdx][taskName] = (demandUnits[d][tIdx][taskName]||0) + units;
      });
    }
  }
  return demandUnits;
}

function capacitySlots(region, avail){
  let cap = 0;
  const S = ROMAN.store;
  for(let d=0; d<7; d++){
    for(let t=0; t<S.hours.length; t++){
      cap += (avail[d][t]?.length || 0);
    }
  }
  return cap;
}

function demandUnitsTotal(demand){
  let sum = 0;
  const S = ROMAN.store;
  for(let d=0; d<7; d++){
    for(let t=0; t<S.hours.length; t++){
      const cell = demand[d][t] || {};
      for(const k in cell) sum += cell[k];
    }
  }
  return sum;
}

function scaleDemand(demand, scale){
  if (scale>=1) return demand;
  const S = ROMAN.store;
  for(let d=0; d<7; d++){
    for(let t=0; t<S.hours.length; t++){
      const cell = demand[d][t]; if(!cell) continue;
      for(const k in cell){ cell[k] *= scale; }
    }
  }
  return demand;
}

function assign(region, avail, demand){
  const S = ROMAN.store;
  const tasksByPrio = tasksByPriorityForRegion(region);
  const schedule = [];

  for(const prio of PRIORITY_ORDER){
    const taskList = tasksByPrio[prio] || [];
    if(!taskList.length) continue;

    for(let d=0; d<7; d++){
      for(let t=0; t<S.hours.length; t++){
        if(!avail[d][t]?.length) continue;

        for(const task of taskList){
          let remaining = Math.ceil((demand[d][t]?.[task.name] || 0));
          if(!remaining) continue;

          for(let i=avail[d][t].length-1; i>=0 && remaining>0; i--){
            const agId = avail[d][t][i];
            const ag = S.agents.find(a=>a.id===agId);
            if(!ag || ag.region!==region) continue;
            if(ag.skills && ag.skills[task.name]===false) continue;

            schedule.push({ dayIdx:d, timeIdx:t, agentId:agId, task:task.name, priority:prio });
            avail[d][t].splice(i,1);
            remaining--;
          }
          if(!demand[d][t]) demand[d][t] = {};
          demand[d][t][task.name] = remaining;
          if(!avail[d][t]?.length) break;
        }
      }
    }
  }
  return schedule;
}

export function optimize(region){
  const demand = buildDemand(region);
  if(!demand){
    alert('Forecast missing. Open the Forecast tab once.'); return;
  }
  const avail = buildAvailability(region);

  const cap = capacitySlots(region, avail);
  const dem = demandUnitsTotal(demand);
  const scale = dem>0 ? Math.min(1, cap/dem) : 1;
  if (scale<1) scaleDemand(demand, scale);

  const schedule = assign(region, avail, demand);
  ROMAN.store.schedule = schedule;

  const used = schedule.length;
  const coverage = (dem>0) ? Math.min(100, (used/dem)*100) : 100;
  ROMAN.store.lastRun = { region, capacity:cap, demand:dem, assigned:used, coverage };

  const badge = document.getElementById('coverageBadge');
  if (badge){
    badge.textContent = `${coverage.toFixed(1)}% coverage`;
    badge.className = 'badge ' + (coverage >= 99 ? 'ok' : (coverage >= 90 ? 'warn' : 'err'));
  }
}

// expose pour le bouton Optimize déjà en place
window.ROMAN_optimize = optimize;

