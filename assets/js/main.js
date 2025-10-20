import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
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

// Init modules
initPlanning();
initAgents();
initTasks();
initForecast();
initRegulations();

// Save/Load/Reset (réafficher les vues après Load)
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
