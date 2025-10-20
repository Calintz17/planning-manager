import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
import { initPlanning } from './planning.js';
import { optimize } from './optimizer.js';
import { initAgents } from './agents.js';
import { initTasks } from './tasks.js';

// Exposer pour planning.js (bouton Optimize)
window.ROMAN_optimize = optimize;

// Tabs
wireTabs();
setActiveTab('Landing');

// Init modules
initPlanning();
initAgents();
initTasks();

// Quand les tâches changent, on réinitialise l’onglet Agents (pour recalculer colonnes de skills)
window.addEventListener('roman:tasks-updated', () => {
  initAgents();
});

// Header buttons Save/Load/Reset
document.getElementById('btnSave')?.addEventListener('click', ()=> saveState());
document.getElementById('btnLoad')?.addEventListener('click', ()=>{
  loadState();
  // rafraîchissements légers
  if (typeof window.initPlannerControls==='function') window.initPlannerControls();
  if (typeof window.renderPlanner==='function') window.renderPlanner();
  // re-init modules dépendants
  initTasks();
  initAgents();
});
document.getElementById('btnResetAll')?.addEventListener('click', ()=> resetAll());
