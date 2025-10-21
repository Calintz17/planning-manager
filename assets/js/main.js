// assets/js/main.js
// Routeur d’onglets + initialisations paresseuses (lazy) de chaque vue

import { ROMAN } from './store.js';
import { initPlanning } from './planning.js';
import { initAttendance } from './attendance.js';

// Si tu as modularisé ces vues, garde-les. Sinon, laisse-les commentées.
import { initAgents } from './agents.js';
import { initTasks } from './tasks.js';
import { initForecast } from './forecast.js';
import { initRegulations } from './regulations.js';

// --- petit helper pour compat avec tes anciennes fonctions de header ---
function callIf(fnA, fnB){ return typeof fnA === 'function' ? fnA : (typeof fnB === 'function' ? fnB : null); }
const SAVE   = callIf(ROMAN?.saveState, ROMAN?.save);
const LOAD   = callIf(ROMAN?.loadState, ROMAN?.load);
const RESET  = callIf(ROMAN?.resetAll, ROMAN?.reset);

// État d’init pour éviter de ré-initialiser une vue à chaque clic d’onglet
const initDone = {
  Attendance: false,
  Landing:    false,
  Agents:     false,
  Tasks:      false,
  Forecast:   false,
  Regulations:false,
};

// Router d’onglets —> affiche le contenu et lance l’init de la vue la 1ʳᵉ fois
function setActiveTab(name){
  // visuel onglets
  document.querySelectorAll('.tab').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===name);
  });
  // montrer/cacher sections
  ['Attendance','Landing','Agents','Tasks','Forecast','Regulations'].forEach(id=>{
    const el = document.getElementById('tab-'+id);
    if (el) el.style.display = (id===name ? 'block' : 'none');
  });

  // init paresseuse de la vue demandée
  if (name==='Attendance' && !initDone.Attendance){ initAttendance(); initDone.Attendance = true; }
  if (name==='Landing'    && !initDone.Landing){    initPlanning();  initDone.Landing    = true; }
  if (name==='Agents'     && !initDone.Agents){     initAgents?.();  initDone.Agents     = true; }
  if (name==='Tasks'      && !initDone.Tasks){      initTasks?.();   initDone.Tasks      = true; }
  if (name==='Forecast'   && !initDone.Forecast){   initForecast?.();initDone.Forecast   = true; }
  if (name==='Regulations'&& !initDone.Regulations){initRegulations?.();initDone.Regulations = true; }
}

// Câblage des boutons d’onglets
function wireTabs(){
  document.querySelectorAll('.tab').forEach(btn=>{
    btn.addEventListener('click', ()=> setActiveTab(btn.dataset.tab));
  });
}

// Boutons d’en-tête (Save / Load / Reset)
function wireHeader(){
  const elSave  = document.getElementById('btnSave');
  const elLoad  = document.getElementById('btnLoad');
  const elReset = document.getElementById('btnResetAll');

  elSave ?.addEventListener('click', ()=> SAVE  && SAVE());
  elLoad ?.addEventListener('click', ()=> LOAD  && LOAD());
  elReset?.addEventListener('click', ()=> RESET && RESET());
}

// --------- Démarrage ---------
document.addEventListener('DOMContentLoaded', ()=>{
  wireHeader();
  wireTabs();

  // 👉 ouvre l’onglet Attendance au chargement
  setActiveTab('Attendance');
});

// Exporte setActiveTab si tu veux pouvoir le réutiliser ailleurs
export { setActiveTab };

