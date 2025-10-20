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
