import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
import { initPlanning } from './planning.js';
import { optimize } from './optimizer.js';
import { initAgents } from './agents.js';

// Exposer pour planning.js (le bouton appelle window.ROMAN_optimize)
window.ROMAN_optimize = optimize;

// Tabs
wireTabs();
setActiveTab('Landing');

// Init modules
initPlanning();
initAgents(); // <-- active l’onglet Agents

// Header buttons Save/Load/Reset
document.getElementById('btnSave')?.addEventListener('click', ()=> saveState());
document.getElementById('btnLoad')?.addEventListener('click', ()=>{
  loadState();
  // re-peint léger
  if(typeof window.initPlannerControls==='function') window.initPlannerControls();
  if(typeof window.renderPlanner==='function') window.renderPlanner();
  // rafraîchir l’onglet Agents (si besoin)
  // on relance initAgents pour reconstruire les têtes/skills selon tasks :
  initAgents();
});
document.getElementById('btnResetAll')?.addEventListener('click', ()=> resetAll());
