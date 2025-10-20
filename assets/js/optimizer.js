// assets/js/optimizer.js
// Optimiseur "greedy" MVP. Utilise ROMAN.store (agents, hours, tasks, forecast).
import { ROMAN } from './store.js';

const PRIORITY_ORDER = ['Mandatory','P1','P2','P3'];
const SLOT_MINUTES = 30;

// Helpers
const pctToNumber = str => parseFloat(String(str).replace('%','').replace(',','.')) || 0;
function toMin(t){ const [h,m] = t.split(':').map(Number); return h*60+m; }
function between(t, a, b){ return t>=a && t<b; }

function tasksByPriority(S){
  const defaults = [
    { name:'Email', priority:'P1', aht:8, enabled:true },
    { name:'Call', priority:'P1', aht:12, enabled:true },
    { name:'Clienteling', priority:'P2', aht:15, enabled:true },
    { name:'Chat', priority:'P1', aht:6, enabled:true },
    { name:'DELIVERY', priority:'P2', aht:10, enabled:true },
    { name:'DELIVERY ISSUE/DELAY', priority:'P2', aht:12, enabled:true },
    { name:'DELIVERY OPEN INVESTIGATION', priority:'P2', aht:15, enabled:true },
    { name:'DELIVERY RETURN TO SENDER', priority:'P2', aht:10, enabled:true },
    { name:'DOC', priority:'P2', aht:7, enabled:true },
    { name:'FRAUD', priority:'Mandatory', aht:20, enabled:true },
    { name:'PAYMENT', priority:'P1', aht:8, enabled:true },
    { name:'PAYMENT NOT CAPTURED', priority:'P1', aht:10, enabled:true },
    { name:'REFUNDS', priority:'P1', aht:12, enabled:true },
    { name:'REFUNDS STATUT', priority:'P2', aht:6, enabled:true },
    { name:'REPAIR', priority:'P2', aht:30, enabled:true },
    { name:'RETURN', priority:'P1', aht:10, enabled:true },
    { name:'RETURN IN STORE', priority:'P1', aht:8, enabled:true },
    { name:'RETURN KO', priority:'P2', aht:12, enabled:true },
    { name:'SHORT SHIPMENT', priority:'P2', aht:15, enabled:true },
  ];
  const list = (Array.isArray(S.tasks) && S.tasks.length) ? S.tasks : defaults;
  const map = { Mandatory:[], P1:[], P2:[], P3:[] };
  for(const t of list){ if(t.enabled && map[t.priority]) map[t.priority].push(t); }
  return map;
}

const REGION_KEYS = { 'Europe':'EU','Americas':'US','Greater China':'CN','Japan':'JP','South Korea':'KR','SEAO':'SEAO' };

function getForecastInputs(S, region){
  const F = S.forecast || {};
  // Totaux par défaut si rien n’est saisi
  const DEFAULT_TOTALS = {
    'Europe': 90000, 'Americas': 49713, 'Greater China': 119038,
    'Japan': 39269, 'South Korea': 39269, 'SEAO': 25650
  };
  const total = (F.totals && F.totals[region]) ?? DEFAULT_TOTALS[region] ?? 0;

  const w = S.weekISO || 'w01';
  const wIdx = Math.max(0, Math.min(51, parseInt(w.slice(1),10)-1));
  const k = REGION_KEYS[region] || 'EU';
  const weekly = (F.weekly && F.weekly[k]) || Array(52).fill('1,92'); // ~1.92% ≈ 100/52
  const weekPct = pctToNumber(weekly[wIdx]);

  // Split tâches (ligne = 100%)
  const DEFAULT_TASK_SPLIT = {
    'Europe':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
    'Americas':[28,29,4,1,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
    'Greater China':[4,4,20,34,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
    'Japan':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
    'South Korea':[28,34,0,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1],
    'SEAO':[28,30,4,0,3,3,2,1,1,2,2,2,3,3,7,4,3,1,1]
  };
  const tasks = (F.taskSplit && F.taskSplit[region]) || DEFAULT_TASK_SPLIT[region] || [];

  // Horaire par défaut : 7 lignes (jours) avec 1er col = part du jour, puis 26 colonnes d’heures
  const HOURLY_DEFAULT = [
    '1-Monday\t18\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,9\t3,8\t16,5\t12,0\t10,5\t10,5\t9,4\t10,5\t8,8\t7,9\t6,1\t2,3\t0,3\t0,2\t0,1\t0,0\t0,0\t0,0\t0,0',
    '2-Tuesday\t17\t0,1\t0,0\t0,0\t0,0\t0,0\t0,0\t0,0\t0,2\t1,1\t4,0\t13,7\t11,2\t10,4\t10,3\t10,6\t9,5\t9,0\t8,8\t7,7\t2,8\t0,5\t0,1\t0,1\t0,1\t0,0\t0,0\t0,0',
    '3-Wednesday\t18\t0,1\t0,0\t0,1\t0,0\t0,0\t0,0\t0,1\t0,2\t1,3\t4,1\t16,0\t12,6\t10,5\t9,9\t9,6\t9,1\t9,1\t8,0\t6,2\t2,3\t0,6\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '4-Thursday\t16\t0,0\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t1,0\t4,0\t14,1\t12,7\t10,1\t10,1\t9,9\t9,9\t9,9\t8,3\t6,5\t2,4\t0,4\t0,3\t0,1\t0,1\t0,0\t0,0\t0,0',
    '5-Friday\t16\t0,1\t0,0\t0,0\t0,0\t0,0\t0,1\t0,1\t0,1\t1,3\t4,0\t15,7\t13,1\t10,9\t9,4\t9,7\t10,2\t9,1\t7,3\t6,0\t1,9\t0,4\t0,4\t0,2\t0,1\t0,0\t0,0\t0,0',
    '6-Saturday\t10\t0,0\t0,1\t0,1\t0,1\t0,1\t0,0\t0,1\t0,1\t0,5\t2,9\t14,9\t13,9\t9,5\t10,4\t8,9\t9,9\t9,7\t8,6\t5,6\t3,8\t0,6\t0,2\t0,2\t0,1\t0,0\t0,0\t0,0',
    '7-Sunday\t4\t0,1\t0,1\t0,1\t0,0\t0,0\t0,1\t0,1\t0,1\t0,8\t0,9\t3,2\t13,8\t10,6\t14,7\t10,6\t10,9\t12,1\t10,0\t8,5\t1,7\t0,6\t0,3\t0,3\t0,1\t0,0\t0,0\t0,0'
  ];
  const hourlyRows = (F.hourly && F.hourly[region]) || HOURLY_DEFAULT;

  return { total, weekPct, tasks, hourlyRows };
}

function buildAvailability(S, region){
  const avail = {};
  for(let d=0; d<7; d++){
    avail[d] = {};
    for(let t=0; t<S.hours.length; t++) avail[d][t] = [];
  }
  const lunchStart = toMin('12:00'), lunchEnd = toMin('13:00'); // 60m
  const breakSlots = [ toMin('10:30'), toMin('16:30') ];

  for(const ag of S.agents){
    if(ag.region !== region) continue;
    for(let d=0; d<7; d++){
      const present = Array.isArray(ag.present) ? ag.present[d] : (d<5);
      const pto = Array.isArray(ag.pto) ? ag.pto[d] : false;
      if(!present || pto) continue;

      for(let t=0; t<S.hours.length; t++){
        const startMin = toMin(S.hours[t]);
        if(between(startMin, lunchStart, lunchEnd)) continue;
        if(breakSlots.some(bs => bs===startMin)) continue;
        avail[d][t].push(ag.id);
      }
    }
  }
  return avail;
}

function buildDemand(S, region){
  const fx = getForecastInputs(S, region);
  if(!fx) return null;

  const taskNames = (Array.isArray(S.tasks) && S.tasks.length)
    ? S.tasks.map(t=>t.name)
    : ['Email','Call','Clienteling','Chat','DELIVERY','DELIVERY ISSUE/DELAY','DELIVERY OPEN INVESTIGATION','DELIVERY RETURN TO SENDER','DOC','FRAUD','PAYMENT','PAYMENT NOT CAPTURED','REFUNDS','REFUNDS STATUT','REPAIR','RETURN','RETURN IN STORE','RETURN KO','SHORT SHIPMENT'];

  const weeklyVolume = fx.total * (fx.weekPct/100);

  const demandUnits = {};
  for(let d=0; d<7; d++){
    demandUnits[d] = {};
    const row = (fx.hourlyRows[d] || '').split('\t');
    const daySharePct = pctToNumber(row[1] || 0);
    const dayVolume = weeklyVolume * (daySharePct/100);

    let hourPcts = row.slice(2).map(pctToNumber);
    if(hourPcts.length < ROMAN.store.hours.length){
      hourPcts = hourPcts.concat(Array(ROMAN.store.hours.length - hourPcts.length).fill(0));
    }
    const sumH = hourPcts.reduce((a,b)=>a+b,0) || 1;
    const norm = hourPcts.map(x => x * (100/sumH));

    for(let tIdx=0; tIdx<ROMAN.store.hours.length; tIdx++){
      const hourShare = norm[tIdx] || 0;
      const slotVolume = dayVolume * (hourShare/100);

      taskNames.forEach((taskName, i)=>{
        const taskSplitPct = fx.tasks?.[i] ?? 0;
        const taskItems = slotVolume * (taskSplitPct/100);
        const task = (ROMAN.store.tasks || []).find(tt=>tt.name===taskName);
        const ahtMin = task?.aht || 10;
        const units = taskItems * (ahtMin / SLOT_MINUTES);
        if(!demandUnits[d][tIdx]) demandUnits[d][tIdx] = {};
        demandUnits[d][tIdx][taskName] = (demandUnits[d][tIdx][taskName]||0) + units;
      });
    }
  }
  return demandUnits;
}

function capacitySlots(S, region, avail){
  let cap = 0;
  for(let d=0; d<7; d++){
    for(let t=0; t<S.hours.length; t++){
      cap += (avail[d][t]?.length || 0);
    }
  }
  return cap;
}

function demandUnitsTotal(demand){
  let sum = 0;
  for(let d=0; d<7; d++){
    for(let t=0; t<ROMAN.store.hours.length; t++){
      const cell = demand[d][t] || {};
      for(const k in cell){ sum += cell[k]; }
    }
  }
  return sum;
}

function scaleDemand(demand, scale){
  if(scale>=1) return demand;
  for(let d=0; d<7; d++){
    for(let t=0; t<ROMAN.store.hours.length; t++){
      const cell = demand[d][t]; if(!cell) continue;
      for(const k in cell){ cell[k] = cell[k]*scale; }
    }
  }
  return demand;
}

function assign(S, region, avail, demand){
  const tByPrio = tasksByPriority(S);
  const schedule = [];

  for(const prio of PRIORITY_ORDER){
    const taskList = tByPrio[prio] || [];
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
  const S = ROMAN.store;
  const demand = buildDemand(S, region);
  if(!demand){
    alert('Forecast data missing. Open the Forecast tab once to initialize defaults.');
    return;
  }
  const avail = buildAvailability(S, region);

  const cap = capacitySlots(S, region, avail);
  const dem = demandUnitsTotal(demand);
  const scale = dem>0 ? Math.min(1, cap / dem) : 1;
  if(scale < 1) scaleDemand(demand, scale);

  const schedule = assign(S, region, avail, demand);
  S.schedule = schedule;

  const used = schedule.length;
  const coverage = (dem>0) ? Math.min(100, (used/dem)*100) : 100;
  S.lastRun = { region, capacity:cap, demand:dem, assigned:used, coverage };

  const badge = document.getElementById('coverageBadge');
  if(badge){
    badge.textContent = `${coverage.toFixed(1)}% coverage`;
    badge.className = 'badge ' + (coverage >= 99 ? 'ok' : (coverage >= 90 ? 'warn' : 'err'));
  }
}
