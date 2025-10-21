// assets/js/planning.js
// Planner responsive (auto-fit par défaut), mobile-friendly, palette harmonisée

import { ROMAN } from './store.js';

// ============ Config UI ============
const UI = {
  density: 'compact',  // 'compact' | 'cozy'
  zoom: 1.0,           // utilisé si fit=false
  fit: true,           // ✅ fit-to-width activé par défaut
  mobileBreakpoint: 600 // px (iPhone 12 Pro ~390px)
};

// Palette harmonisée (10 tâches) — couleurs fournies par toi
const TASK_COLORS = {
  'Call':         '#9cdcf0',
  'Mail':         '#f59e6c',
  'Chat':         '#d0f7be',
  'Clienteling':  '#f2e3a5',
  'Fraud':        '#c7c9d4',
  'Back Office':  '#cfb2b2',
  'Lunch Break':  '#f0efed',
  'Break':        '#f0efed',
  'Morning Brief':'#e2f2e1',
  'Training':     '#FFECCE'
};

// === injecte/MAJ un bloc <style> dédié au planner + petites corrections responsive ===
function ensureStyle() {
  let tag = document.getElementById('planner-style');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'planner-style';
    document.head.appendChild(tag);
  }

  const compact = UI.density === 'compact';
  const fontSize = compact ? '11px' : '12px';
  const cellH = compact ? 22 : 28;
  const agentColW = compact ? 128 : 168; // un poil plus étroit pour tenir sur mobile
  const timeColMin = compact ? 48 : 64;  // ✅ réduit pour mieux rentrer
  const legendFont = compact ? '10px' : '11px';

  const css = `
  .planner {
    border:1px solid var(--border);
    border-radius:12px;
    overflow:auto;
    background:#fff;
    -webkit-overflow-scrolling: touch;
  }
  .planner .grid{
    display:grid;
    grid-auto-rows:${cellH}px;
    font-size:${fontSize};
    min-width:${Math.max(720, 26 * timeColMin + agentColW + 24)}px; /* ✅ min plus raisonnable */
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
    grid-column:1 / -1;
    background:#fff; display:flex; align-items:center; gap:8px;
    padding:6px 8px; border-top:2px solid var(--border);
    position:sticky; top:${cellH}px; z-index:1;
  }
  .planner .time{ text-align:center; color:#555; }

  /* Legend responsive: wrap + scroll si besoin */
  .legend{
    display:flex; flex-wrap:wrap; gap:6px;
  }
  .legend.scrolling{
    flex-wrap:nowrap; overflow:auto; -webkit-overflow-scrolling:touch;
  }
  .legend .task-chip{
    font-size:${legendFont}; padding:${compact ? '2px 6px' : '3px 8px'};
    border-radius:6px; border:1px solid var(--border);
    white-space:nowrap;
  }

  /* Zoom/fitting wrapper */
  #plannerZoomWrap{ transform-origin: top left; }

  /* Controls densité/zoom/fit plus compacts */
  #plannerControls .select, #plannerControls .btn{
    font-size:${compact ? '12px' : '13px'};
    padding:${compact ? '6px 8px' : '8px 12px'};
  }

  /* Petit ajustement sur très petit écran */
  @media (max-width: ${UI.mobileBreakpoint}px){
    #plannerControls{ display:none; } /* on cache les contrôles avancés sur mobile */
  }
  `;

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

// calc end time +30min
function add30(start){
  const [h,m] = start.split(':').map(Number);
  const d = new Date(2000,0,1,h,m+30);
  return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

// export CSV (identique)
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

// === UI CONTROLS (zoom/density/fit) — visibles sur desktop, cachés sur mobile
function renderExtraControls(){
  const hostRow = document.querySelector('#tab-Landing .row .controls-right');
  if (!hostRow || document.getElementById('plannerControls')) return;

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
    <button class="btn ghost" id="pmFit">${UI.fit ? 'Fit ON' : 'Fit'}</button>
  `;
  hostRow.appendChild(container);

  const selDensity = container.querySelector('#pmDensity');
  const selZoom = container.querySelector('#pmZoom');
  const btnFit = container.querySelector('#pmFit');

  selDensity.value = UI.density;
  selDensity.addEventListener('change', () => {
    UI.density = selDensity.value;
    ensureStyle();
    renderPlanner(); // regen
  });

  selZoom.value = String(UI.zoom);
  selZoom.addEventListener('change', () => {
    UI.zoom = parseFloat(selZoom.value || '1');
    UI.fit = false;
    btnFit.textContent = 'Fit';
    applyZoom();
  });

  btnFit.addEventListener('click', () => {
    UI.fit = !UI.fit;
    btnFit.textContent = UI.fit ? 'Fit ON' : 'Fit';
    applyZoom(true);
  });
}

function applyZoom(forceFit=false, retry=0){
  const wrap = document.getElementById('plannerZoomWrap');
  if (!wrap) return;

  const container = document.getElementById('plannerHost');
  const grid = wrap.querySelector('.grid');
  if (!container || !grid) return;

  // Si le grid n'a pas encore sa largeur (render async), on réessaie un court instant plus tard
  if (grid.scrollWidth === 0 && retry < 5){
    setTimeout(()=>applyZoom(forceFit, retry+1), 50);
    return;
  }

  if (UI.fit || forceFit){
    const containerW = container.clientWidth ? (container.clientWidth - 8) : 0;
    const gridW = grid.scrollWidth || 1;
    const z = Math.max(0.4, Math.min(1.25, containerW / gridW));
    wrap.style.transform = `scale(${z})`;
  } else {
    wrap.style.transform = `scale(${UI.zoom})`;
  }
}

// ====== Public API ======
export function initPlanning(){
  // Fit/densité par défaut sur mobile
  if (window.innerWidth <= UI.mobileBreakpoint){
    UI.density = 'compact';
    UI.fit = true;
  }

  ensureStyle();
  renderExtraControls();
  initPlannerControls();
  renderPlanner();

  // Légende en mode “scrolling” si peu de place
  const legend = document.querySelector('#tab-Landing .legend');
  if (legend){
    if (legend.scrollWidth > legend.clientWidth) legend.classList.add('scrolling');
    else legend.classList.remove('scrolling');
  }

  // Re-fit au resize
  window.addEventListener('resize', ()=>{
    ensureStyle();
    applyZoom(true);
    const legend = document.querySelector('#tab-Landing .legend');
    if (legend){
      if (legend.scrollWidth > legend.clientWidth) legend.classList.add('scrolling');
      else legend.classList.remove('scrolling');
    }
  });

  // Boutons standard
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

  const compact = UI.density === 'compact';
  const agentColW = compact ? 128 : 168;
  const timeColMin = compact ? 48 : 64;
  grid.style.gridTemplateColumns = `${agentColW}px repeat(${hours.length}, minmax(${timeColMin}px, 1fr))`;

  // header
  for(let c=0;c<cols;c++){
    const cell = document.createElement('div');
    cell.className = 'cell head' + (c===0?' row-label':' time');
    cell.textContent = (c===0?'Agent':hours[c-1]);
    grid.appendChild(cell);
  }

  // helper présence
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
    head.innerHTML = `<span class="day-title">${days[d]}</span><span class="muted">|</span><span class="muted">Agents:</span> <strong>${presentToday.length}</strong>`;
    head.style.gridColumn = `1 / ${cols+1}`;
    grid.appendChild(head);

    if (presentToday.length===0){
      for(let c=0;c<cols;c++){
        const cell = document.createElement('div');
        cell.className = 'cell' + (c===0?' row-label':'');
        cell.textContent = (c===0? '—' : '');
        grid.appendChild(cell);
      }
      continue;
    }

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
  applyZoom(true);

  // drag-scroll
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
    const walk = (x - startX) * 1;
    scroller.scrollLeft = scrollLeft - walk;
  });
}

