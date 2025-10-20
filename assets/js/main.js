import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
import { initPlanning } from './planning.js';
import { optimize } from './optimizer.js';

// Exposer pour planning.js (le bouton appelle window.ROMAN_optimize)
window.ROMAN_optimize = optimize;

// Tabs
wireTabs();
setActiveTab('Landing');

// Init planner
initPlanning();

// Header buttons Save/Load/Reset
document.getElementById('btnSave')?.addEventListener('click', ()=> saveState());
document.getElementById('btnLoad')?.addEventListener('click', ()=>{
  loadState();
  if(typeof window.initPlannerControls==='function') window.initPlannerControls();
  if(typeof window.renderPlanner==='function') window.renderPlanner();
});
document.getElementById('btnResetAll')?.addEventListener('click', ()=> resetAll());
