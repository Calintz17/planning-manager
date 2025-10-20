import { ROMAN, wireTabs, setActiveTab, saveState, loadState, resetAll } from './store.js';
import { initPlanning } from './planning.js';

// Wire tabs
wireTabs();

// Landing par défaut
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
