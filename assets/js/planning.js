// Planner (onglet Landing) — identique au comportement précédent
import { ROMAN } from './store.js';

export function initPlanning(){
  const S = ROMAN.store;

  function seedMock(){
    const tasksA = [['Email',4], ['Call',4], ['Lunch',2], ['Chat',4], ['Payment',3], ['Break',1]];
    const tasksB = [['Chat',4], ['Email',4], ['Lunch',2], ['Call',4], ['Fraud',2], ['Break',1]];
    const hoursPerBlock = 0.5; // 30 min slots
    function pushBlocks(agentId, dayIdx, plan){
      let tIndex = 0;
      for(const [task,hours] of plan){
        const slots = Math.round(hours / hoursPerBlock);
        for(let s=0;s<slots;s++){
          S.schedule.push({ dayIdx, timeIdx: tIndex, agentId, task });
          tIndex++;
        }
      }
    }
    S.schedule = [];
    for(let d=0; d<5; d++){
      pushBlocks('a1', d, tasksA);
      pushBlocks('a2', d, tasksB);
    }
  }

  function renderPlanner(){
    const host = document.getElementById('plannerHost');
    const hours = S.hours; 
    const days = S.days; 
    const agents = S.agents.filter(a => a.region === S.region);

    const cols = 1 + hours.length;
    const grid = document.createElement('div');
    grid.className = 'grid';
    grid.style.gridTemplateColumns = `200px repeat(${hours.length}, minmax(80px,1fr))`;

    // header row
    for(let c=0;c<cols;c++){
      const cell = document.createElement('div');
      cell.className = 'cell head' + (c===0?' row-label':' time');
      cell.textContent = (c===0?'Agent':hours[c-1]);
      grid.appendChild(cell);
    }

    function agentsPresentForDay(dayIdx){
      return agents.filter(ag => {
        const present = Array.isArray(ag.present) ? !!ag.present[dayIdx] : (dayIdx<5);
        const pto = Array.isArray(ag.pto) ? !!ag.pto[dayIdx] : false;
        return present && !pto;
      });
    }

    for(let d=0; d<days.length; d++){
      const presentToday = agentsPresentForDay(d);
      const head = document.createElement('div');
      head.className = 'day-group-head';
      head.innerHTML = `<span class="day-title">${days[d]}</span><span class="muted">|</span><span class="muted">People present:</span> <strong>${presentToday.length}</strong>`;
      head.style.gridColumn = `1 / ${cols+1}`;
      grid.appendChild(head);

      for(const ag of presentToday){
        for(let c=0; c<cols; c++){
          const cell = document.createElement('div');
          cell.className = 'cell' + (c===0?' row-label':'');
          if(c===0){
            cell.innerHTML = `<strong>${ag.name}</strong>`;
          }else{
            const timeIdx = c-1;
            const item = S.schedule.find(x=> x.agentId===ag.id && x.dayIdx===d && x.timeIdx===timeIdx);
            if(item){
              const cls = 't-'+String(item.task).toUpperCase().replace(/\s+/g,'-');
              cell.classList.add(cls);
              cell.textContent = item.task;
            } else {
              cell.textContent = '';
            }
          }
          grid.appendChild(cell);
        }
      }

      if(presentToday.length===0){
        for(let c=0; c<cols; c++){
          const cell = document.createElement('div');
          cell.className = 'cell' + (c===0?' row-label':'');
          if(c===0){ cell.innerHTML = `<span class="muted">No agents present</span>`; }
          grid.appendChild(cell);
        }
      }
    }

    host.innerHTML = '';
    host.appendChild(grid);
  }

  function initPlannerControls(){
    const ySel = document.getElementById('selYear');
    const now = new Date();
    const years = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];
    ySel.innerHTML = years.map(y=>`<option${(S.year===y)?' selected':''}>${y}</option>`).join('');
    if(!S.year) S.year = now.getFullYear();
    ySel.value = S.year;
    ySel.addEventListener('change', ()=> { S.year = parseInt(ySel.value,10); });

    const wSel = document.getElementById('selWeek');
    const opts = Array.from({length:52}, (_,i)=>{
      const w = 'w'+String(i+1).padStart(2,'0');
      return `<option value="${w}">${w}</option>`;
    });
    wSel.innerHTML = opts.join('');
    wSel.value = S.weekISO || 'w01';
    wSel.addEventListener('change', ()=> { S.weekISO = wSel.value; });

    const rSel = document.getElementById('selRegion');
    rSel.value = S.region || 'Europe';
    rSel.addEventListener('change', ()=> { S.region = rSel.value; renderPlanner(); });
  }

  function exportCSV(){
    const lines = ['day,region,agent,start,end,task,priority'];
    const slotMins = 30;
    for(const item of S.schedule){
      const day = S.days[item.dayIdx];
      const start = S.hours[item.timeIdx];
      const [h,m] = start.split(':').map(Number);
      const dt = new Date(2000,0,1,h,m+slotMins);
      const end = String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0');
      const agent = S.agents.find(a=>a.id===item.agentId)?.name || '';
      const priority = '';
      lines.push([day,S.region,agent,start,end,item.task,priority].join(','));
    }
    const blob = new Blob([lines.join('\n')], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roman-schedule.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // wire boutons
  document.getElementById('btnOptimize').addEventListener('click', ()=>{
    if(typeof window.ROMAN_optimize === 'function'){
      window.ROMAN_optimize(ROMAN.store.region);
    } else {
      alert('Optimizer not initialized.');
    }
    renderPlanner();
  });
  document.getElementById('btnClear').addEventListener('click', ()=>{
    ROMAN.store.schedule = []; renderPlanner();
  });
  document.getElementById('btnExport').addEventListener('click', exportCSV);

  // init
  seedMock();
  initPlannerControls(); 
  renderPlanner();

  // Expose pour autres briques
  window.renderPlanner = renderPlanner;
  window.initPlannerControls = initPlannerControls;
}
