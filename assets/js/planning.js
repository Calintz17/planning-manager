// assets/js/planning.js
// Landing / Planner — UI compact + mobile-friendly (fit/zoom/density) + color palette harmonisée

import { ROMAN } from './store.js';

// ============ Config UI ============
const UI = {
  density: 'compact', // 'compact' | 'cozy'
  zoom: 1.0,          // 0.5 .. 1.2
  fit: false,         // fit-to-width
  mobileBreakpoint: 480 // px
};

// Palette couleurs (pastel harmonisé)
const TASK_COLORS = {
  'Email':        '#E8F0FE',
  'Call':         '#E6F7F2',
  'Clienteling':  '#FEEBF0',
  'Chat':         '#F3E8FF',
  'PAYMENT':      '#FFF1E6',
  'PAYMENT NOT CAPTURED': '#FFE8EA',
  'FRAUD':        '#FFE8D9',
  'DELIVERY':     '#FDF6CD',
  'DELIVERY ISSUE/DELAY': '#FFE6E6',
  'DELIVERY OPEN INVESTIGATION': '#F1E6FF',
  'DELIVERY RETURN TO SENDER': '#E6FBFF',
  'DOC':          '#ECE7FF',
  'REFUNDS':      '#EEEDED',
  'REFUNDS STATUT':'#F2F6FA',
  'REPAIR':       '#E6FBEE',
  'RETURN':       '#FFFADD',
  'RETURN IN STORE':'#E7ECFF',
  'RETURN KO':    '#FFE6EA',
  'SHORT SHIPMENT':'#DAF7EF',
  'Lunch':        '#FFECCE',
  'Break':        '#F5F5F5'
};

// === injecte/MAJ un bloc <style> dédié au planner ===
function ensureStyle() {
  let tag = document.getElementById('planner-style');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'planner-style';
    document.head.appendChild(tag);
  }

  const compact = UI.density === 'compact';
  const fontSize = compact ? '11px' : '12px';
  const cellH = compact ? 22 : 28; // hauteur cellule
  const agentColW = compact ? 140 : 180; // largeur colonne agent
  const timeColMin = compact ? 56 : 72;  // largeur min col horaire
  const legendFont = compact ? '10px' : '11px';

  // assemble CSS
  const css = `
  /* ====== Planner theming / layout ====== */
  .planner {
    border:1px solid var(--border);
    border-radius:12px;
    overflow:auto;
    background:#fff;
    -webkit-overflow-scrolling: touch;
  }
  .planner .grid{
    display:grid;
    grid-auto-rows: ${cellH}px;
    font-size:${fontSize};
    min-width: ${Math.max(900, 26* timeColMin + agentColW + 32)}px;
  }
  .planner .cell{
    border-top:1px solid var(--border);
    border-left:1px solid var(--border);
    padding:2px 6px;
    line-height:${cellH - 6}px;
    white-space:nowrap;
    overflow:hidden;
    text-overflow:ellipsis;
  }
  .planner .head{
    position:sticky; top:0; z-index:3; background:#fafafa; font-weight:600;
  }
  .planner .row-label{
    position:sticky; left:0; z-index:2; background:#fafafa; border-right:1px solid var(--border);
  }
  .planner .day-group-head{
    grid-column: 1 / -1;
    background:#fff; display:flex; align-items:center; gap:8px;
    padding:6px 8px; border-top:2px solid var(--border);
    position:sticky; top: ${cellH}px; z-index:1;
  }
  .planner .day-title{ font-weight:700; }
  .planner .muted{ color:var(--muted); }

  /* hour header cells */
  .planner .time{ text-align:center; color:#555; }

  /* Legend compact */
  .legend .task-chip{
    font-size:${legendFont}; padding:${compact ? '2px 6px' : '3px 8px'};
    border-radius:6px; border:1px solid var(--border);
  }

  /* Zoom & fit wrappers */
  #plannerZoomWrap{
    transform-origin: top left;
  }

  /* Controls row */
  #plannerControls .select, #plannerControls .btn{
    font-size:${compact ? '12px' : '13px'};
    padding:${compact ? '6px 8px' : '8px 12px'};
  }
  `;

  // couleurs tasks -> classes
  const colorCSS = Object.entries(TASK_COLORS)
    .map(([name,color])=>{
      const cls = 't-' + name.toUpperCase().replace(/\s+/g,'-').replace(/\//g,'-');
      return `.planner .${cls}{ background:${color}; }`;
    }).join('\n');

  tag.textContent = css + '\n' + colorCSS;
}

// util: nom abrégé pour mobile (initiales)
function shortAgent(name){
  const w = String(name||'').trim().split(/\s+/);
  if (window.innerWidth > UI.mobileBreakpoint) return name;
  if (w.length === 1) return w[0].slice(0,8);
  return (w[0][0]||'') + (w[1][0]||'');
}

// calcule end time +30min
function add30(start){
  const [h,m] = start.split(':').map(Number);
  const d = new Date(2000,0,1,h,m+30);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

// export CSV (inchangé mais compact)
function exportCSV(){
  const S = ROMAN.store;
  const lines = ['day,region,agent,start,end,task,priority'];
  for(const item of S.schedule){
    const day = S.days[item.dayIdx];
    const start = S.hours[item.timeIdx];
    const end = add30(start);
    const agent = S.agents.find(a=>a.id===item.agentId)?.name || '';
    const priority = item.priority || '';
    lines.push([day,S.region,agent,start,end,item.task,priority].join(','));
  }
  const blob = new Blob([lines.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roman-schedule.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// === UI CONTROLS (zoom/density/fit) ===
function renderExtraControls(){
  const hostRow = document.querySelector('#tab-Landing .row .controls-right');
  if (!hostRow) return;
  const container = document.createElement('div');
  container.id = 'plannerControls';
  container.className = 'row';
  container.style.gap = '8px';
  container.style.marginLeft = '8px';
  container.innerHTML = `
    <span class="label">Density</span>
    <select id="pmDensity" class="select">
      <option value="compact">Compact</option>
      <option value="cozy">Cozy</option>
    </select>
    <span class="label">Zoom</span>
    <select id="pmZoom" class="select">
      <option value="0.5">50%</option>
      <option value="0.6">60%</option>
      <option value="0.75">75%</option>
      <option value="0.9">90%</option>
      <option value="1.0" selected>100%</option>
      <option value="1.1">110%</option>
      <option value="1.2">120%</option>
    </select>
    <button class="btn ghost" id="pmFit">Fit</button>
  `;
  hostRow.appendChild(container);

  // wire
  const selDensity = container.querySelector('#pmDensity');
  const selZoom = container.querySelector('#pmZoom');
  const btnFit = container.querySelector('#pmFit');

  selDensity.value = UI.density;
  selDensity.addEventListener('change', () => {
    UI.density = selDensity.value;
    ensureStyle();
    renderPlanner(); // regen taille lignes/sticky
  });

  selZoom.value = String(UI.zoom);
  selZoom.addEventListener('change', () => {
    UI.zoom = parseFloat(selZoom.value || '1');
    UI.fit = false;
    btnFit.classList.remove('ok');
    applyZoom();
  });

  btnFit.addEventListener('click', () => {
    UI.fit = !UI.fit;
    btnFit.classList.toggle('ok', UI.fit);
    applyZoom(true);
  });
}

function applyZoom(forceFit=false){
  const wrap = document.getElementById('plannerZoomWrap');
  if (!wrap) return;

  if (UI.fit || forceFit){
    // fit to width of container
    const container = document.getElementById('plannerHost');
    const grid = wrap.querySelector('.grid');
    if (!container || !grid) return;
    const containerW = container.clientWidth - 8; // padding
    const gridW = grid.scrollWidth;
    const z = Math.max(0.45, Math.min(1.2, containerW / gridW));
    wrap.style.transform = `scale(${z})`;
  } else {
    wrap.style.transform = `scale(${UI.zoom})`;
  }
}

// === Core render ===
export function initPlanning(){
  // Ajoute contrôles
  renderExtraControls();

  // boutons existants
  document.getElementById('btnOptimize')?.addEventListener('click', ()=>{
    if (typeof window.ROMAN_optimize === 'function'){
      window.ROMAN_optimize(ROMAN.store.region);
      renderPlanner();
    }
  });
  document.getElementById('btnClear')?.addEventListener('click', ()=>{
    ROMAN.store.schedule = []; renderPlanner();
  });
  document.getElementById('btnExport')?.addEventListener('click', exportCSV);

  // Densité par défaut sur mobile
  if (window.innerWidth <= UI.mobileBreakpoint){
    UI.density = 'compact';
    UI.zoom = 0.9;
  }

  ensureStyle();
  initPlannerControls();
  renderPlanner();

  // fit auto à la fin du premier render si petit écran
  if (window.innerWidth <= UI.mobileBreakpoint){
    UI.fit = true;
    applyZoom(true);
  }

  // re-fit au resize
  window.addEventListener('resize', ()=> {
    ensureStyle();
    if (UI.fit) applyZoom(true);
  });
}

export function initPlannerControls(){
  const S = ROMAN.store;
  const ySel = document.getElementById('selYear');
  const now = new Date();
  const years = [now.getFullYear()-1, now.getFullYear(), now.getFullYear()+1];
  ySel.innerHTML = years.map(y=>`<option${(S.year===y)?' selected':''}>${y}</option>`).join('');
  if(!S.year) S.year = now.getFullYear();
  ySel.value = S.year;
  ySel.addEventListener('change', ()=> { S.year = parseInt(ySel.value,10); });

  // Week
  const wSel = document.getElementById('selWeek');
  const opts = Array.from({length:52}, (_,i)=>{
    const w = 'w'+String(i+1).padStart(2,'0');
    return `<option value="${w}">${w}</option>`;
  });
  wSel.innerHTML = opts.join('');
  wSel.value = S.weekISO || 'w01';
  wSel.addEventListener('change', ()=> { S.weekISO = wSel.value; });

  // Region
  const rSel = document.getElementById('selRegion');
  rSel.value = S.region || 'Europe';
  rSel.addEventListener('change', ()=> { S.region = rSel.value; renderPlanner(); });
}

export function renderPlanner(){
  ensureStyle();

  const S = ROMAN.store;
  const host = document.getElementById('plannerHost');
  if (!host) return;

  // Wrapper pour zoom/fit
  const zoomWrap = document.createElement('div');
  zoomWrap.id = 'plannerZoomWrap';

  const hours = S.hours;
  const days = S.days;
  const agents = S.agents.filter(a => a.region === S.region);

  // colonnes : Agent + N times
  const cols = 1 + hours.length;
  const grid = document.createElement('div');
  grid.className = 'grid';
  // largeur colonne agent + times flex
  const compact = UI.density === 'compact';
  const agentColW = compact ? 140 : 180;
  const timeColMin = compact ? 56 : 72;
  grid.style.gridTemplateColumns = `${agentColW}px repeat(${hours.length}, minmax(${timeColMin}px, 1fr))`;

  // ligne header heures
  for(let c=0;c<cols;c++){
    const cell = document.createElement('div');
    cell.className = 'cell head' + (c===0?' row-label':' time');
    cell.textContent = (c===0?'Agent':hours[c-1]);
    grid.appendChild(cell);
  }

  // helper présence (présent & pas PTO)
  function agentsPresentForDay(dayIdx){
    return agents.filter(ag => {
      const present = Array.isArray(ag.present) ? !!ag.present[dayIdx] : (dayIdx<5);
      const pto = Array.isArray(ag.pto) ? !!ag.pto[dayIdx] : false;
      return present && !pto;
    });
  }

  // jours
  for(let d=0; d<days.length; d++){
    const presentToday = agentsPresentForDay(d);

    // bandeau jour
    const head = document.createElement('div');
    head.className = 'day-group-head';
    head.innerHTML = `<span class="day-title">${days[d]}</span><span class="muted">|</span><span class="muted">Agents:</span> <strong>${presentToday.length}</strong>`;
    head.style.gridColumn = `1 / ${cols+1}`;
    grid.appendChild(head);

    if (presentToday.length===0){
      // ligne vide
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (c===0?' row-label':'');
        cell.textContent = (c===0? '—' : '');
        grid.appendChild(cell);
      }
      continue;
    }

    // lignes agents
    for(const ag of presentToday){
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (c===0?' row-label':'');
        if (c===0){
          cell.innerHTML = `<strong>${shortAgent(ag.name)}</strong>`;
        } else {
          const timeIdx = c-1;
          const item = S.schedule.find(x=> x.agentId===ag.id && x.dayIdx===d && x.timeIdx===timeIdx);
          if (item){
            const cls = 't-'+String(item.task).toUpperCase().replace(/\s+/g,'-').replace(/\//g,'-');
            cell.classList.add(cls);
            cell.textContent = item.task;
            cell.title = `${ag.name} — ${item.task} (${hours[timeIdx]}–${add30(hours[timeIdx])})`;
          } else {
            cell.textContent = '';
          }
        }
        grid.appendChild(cell);
      }
    }
  }

  zoomWrap.appendChild(grid);
  host.innerHTML = '';
  host.appendChild(zoomWrap);

  // appliquer zoom / fit
  applyZoom(UI.fit);

  // drag-scroll au doigt (mobile) + desktop
  const scroller = host;
  let isDown = false, startX = 0, scrollLeft = 0;
  scroller.addEventListener('mousedown', (e)=>{
    isDown = true; scroller.classList.add('dragging');
    startX = e.pageX - scroller.offsetLeft;
    scrollLeft = scroller.scrollLeft;
  });
  document.addEventListener('mouseup', ()=> { isDown = false; scroller.classList.remove('dragging'); });
  scroller.addEventListener('mouseleave', ()=> { isDown = false; scroller.classList.remove('dragging'); });
  scroller.addEventListener('mousemove', (e)=>{
    if(!isDown) return;
    e.preventDefault();
    const x = e.pageX - scroller.offsetLeft;
    const walk = (x - startX) * 1; // vitesse
    scroller.scrollLeft = scrollLeft - walk;
  });
}
