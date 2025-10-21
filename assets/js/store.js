// Etat global + helpers (save/load/reset) + router d'onglets

export const ROMAN = {
  store: {
    region: 'Europe',
    weekISO: (()=>{ 
      const d=new Date(); 
      const onejan=new Date(d.getFullYear(),0,1); 
      const week=Math.ceil((((d-onejan)/86400000)+onejan.getDay()+1)/7); 
      return 'w'+String(week).padStart(2,'0'); 
    })(),
    hours: ['08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30','12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30','18:00','18:30','19:00','19:30','20:00'],
    days: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    agents: [
      { id:'a1', name:'Alex Martin', region:'Europe' },
      { id:'a2', name:'Jamie Lee',  region:'Europe' }
    ],
    // planning: { dayIdx, timeIdx, agentId, task }
    schedule: []
  }
};

// persistence (localStorage)
export function saveState(){
  try{
    localStorage.setItem('ROMAN_STATE', JSON.stringify(ROMAN.store));
    alert('Saved ✔');
  }catch(e){
    alert('Save failed');
    console.error(e);
  }
}
export function loadState(){
  const raw = localStorage.getItem('ROMAN_STATE');
  if(!raw){ alert('Nothing to load'); return; }
  try{
    const parsed = JSON.parse(raw);
    Object.assign(ROMAN.store, parsed);
    alert('Loaded ✔');
  }catch(e){
    alert('Load failed');
    console.error(e);
  }
}
export function resetAll(){
  localStorage.removeItem('ROMAN_STATE');
  location.reload();
}

// Tabs
export function setActiveTab(name){
  document.querySelectorAll('.tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===name);
  });
  ['Landing','Agents','Tasks','Forecast','Regulations'].forEach(id=>{
    const el = document.getElementById('tab-'+id);
    if(el) el.style.display = (id===name?'block':'none');
  });
}
export function wireTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab));
  });
}
// === store.js — append this at the end ===
export function ensureTasksDefaults(){
  const S = ROMAN.store;
  if (Array.isArray(S.tasks) && S.tasks.length === 10) return;

  S.tasks = [
    { name:'Call',          priority:'P1',        aht:12, enabled:true, notes:'' },
    { name:'Mail',          priority:'P1',        aht:8,  enabled:true, notes:'' },
    { name:'Chat',          priority:'P1',        aht:6,  enabled:true, notes:'' },
    { name:'Clienteling',   priority:'P2',        aht:15, enabled:true, notes:'' },
    { name:'Fraud',         priority:'Mandatory', aht:20, enabled:true, notes:'' },
    { name:'Back Office',   priority:'P2',        aht:10, enabled:true, notes:'bucket des BO' },
    { name:'Lunch Break',   priority:'Mandatory', aht:30, enabled:false, notes:'géré par règles' },
    { name:'Break',         priority:'Mandatory', aht:15, enabled:false, notes:'géré par règles' },
    { name:'Morning Brief', priority:'P3',        aht:30, enabled:true, notes:'' },
    { name:'Training',      priority:'P3',        aht:45, enabled:true, notes:'' },
  ];
}

export function ensureForecastDefaults(){
  const S = ROMAN.store;
  if (!S.forecast) S.forecast = {};
  const F = S.forecast;

  // Totaux (exemple)
  F.totals ??= {
    'Europe': 90000, 'Americas': 50000, 'Greater China': 120000,
    'Japan': 40000, 'South Korea': 38000, 'SEAO': 26000
  };

  // Split 10 tâches (même ordre que S.tasks). Doit totaliser ≈100.
  const SPLIT_DEFAULT = [28, 22, 15, 8, 5, 22, 0, 0, 0, 0]; // Lunch/Break gérés ailleurs
  F.taskSplit ??= {
    'Europe': [...SPLIT_DEFAULT],
    'Americas': [...SPLIT_DEFAULT],
    'Greater China': [...SPLIT_DEFAULT],
    'Japan': [...SPLIT_DEFAULT],
    'South Korea': [...SPLIT_DEFAULT],
    'SEAO': [...SPLIT_DEFAULT],
  };

  // Weekly et Hourly: garde tes valeurs actuelles si déjà présentes…
  F.weekly  ??= { EU: new Array(52).fill('2,0'), US: new Array(52).fill('2,0'), CN: new Array(52).fill('2,0'), JP: new Array(52).fill('2,0'), KR: new Array(52).fill('2,0'), SEAO: new Array(52).fill('2,0') };
  F.hourly  ??= {
    'Europe': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')), // placeholders
    'Americas': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')),
    'Greater China': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')),
    'Japan': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')),
    'South Korea': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')),
    'SEAO': Array(7).fill('1-Monday\t18\t' + Array(26).fill('3,8').join('\t')),
  };
}
