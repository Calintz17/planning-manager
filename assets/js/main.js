// assets/js/main.js
import { ROMAN } from './store.js';
import { initAttendance } from './attendance.js'; // we know this one exists

// --- Tabs wiring ------------------------------------------------------------
function setActiveTab(name){
  // toggle active class on buttons
  document.querySelectorAll('.tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===name);
  });

  // show/hide sections
  ['Attendance','Landing','Agents','Tasks','Forecast','Regulations'].forEach(id=>{
    const el = document.getElementById('tab-'+id);
    if (el) el.style.display = (id===name ? 'block' : 'none');
  });

  // lazy-load the JS for the selected tab (no hard requirement on exports)
  lazyLoadForTab(name);
}

async function lazyLoadForTab(name){
  try{
    if (name === 'Attendance') {
      // direct call – attendance.js exports initAttendance
      initAttendance();
      return;
    }
    if (name === 'Landing') {
      const m = await import('./planning.js').catch(()=> ({}));
      // call if provided; ignore otherwise
      (m.initPlanning || m.default || (()=>{}))();
      return;
    }
// Agents tab: load our new UI file and call its init
if (name === 'Agents') {
  const m = await import('./agents-ui.js').catch(()=> ({}));
  (m.initAgentsUI || m.default || (()=>{}))();
  return;
}
    if (name === 'Tasks') {
      const m = await import('./tasks.js').catch(()=> ({}));
      (m.initTasks || m.default || (()=>{}))();
      return;
    }
    if (name === 'Forecast') {
      const m = await import('./forecast.js').catch(()=> ({}));
      (m.initForecast || m.default || (()=>{}))();
      return;
    }
    if (name === 'Regulations') {
      const m = await import('./regulations.js').catch(()=> ({}));
      (m.initRegulations || m.default || (()=>{}))();
      return;
    }
  } catch (e){
    console.warn(`[main] lazyLoadForTab(${name}) error:`, e);
  }
}

// --- Hook up tab buttons ----------------------------------------------------
function wireTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab));
  });
}

// --- Boot -------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  wireTabs();
  // Make Attendance the landing page
  setActiveTab('Attendance');
});
