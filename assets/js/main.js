// assets/js/main.js
import { initAttendance } from './attendance.js';
import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
import { initAuthUI } from './auth.js';        // <-- AJOUT B5
import { initPlanning } from './planning.js';
import { optimize } from './optimizer.js';
import { initAgents } from './agents.js';
import { initTasks } from './tasks.js';
import { initForecast } from './forecast.js';
import { initRegulations } from './regulations.js';

// Exposer pour planning.js (bouton Optimize)
window.ROMAN_optimize = optimize;

// Tabs
wireTabs();
setActiveTab('Landing');

// ====== INIT ORDRE IMPORTANT ======
initAuthUI();      // 1) Auth d'abord (détermine la région + masque les régions non autorisées)
initPlanning();    // 2) Landing
initAgents();      // 3) Agents
initTasks();       // 4) Tasks
initForecast();    // 5) Forecast
initRegulations(); // 6) Regulations

// Save/Load/Reset (repeindre les vues après Load)
document.getElementById('btnSave')?.addEventListener('click', ()=> saveState());
document.getElementById('btnLoad')?.addEventListener('click', ()=>{
  loadState();
  if (typeof window.initPlannerControls==='function') window.initPlannerControls();
  if (typeof window.renderPlanner==='function') window.renderPlanner();
  initTasks();
  initAgents();
  initForecast();
  initRegulations();
});
document.getElementById('btnResetAll')?.addEventListener('click', ()=> resetAll());

