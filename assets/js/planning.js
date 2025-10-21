// assets/js/planning.js
import { ROMAN } from './store.js';
import { supabase } from './supabase.js';
import { ensureTasksDefaults, ensureForecastDefaults } from './store.js';

// helpers simples (heures / jours déjà dans ROMAN.store)
function byId(id){ return document.getElementById(id); }

async function fetchAgentsForRegion(region){
  try{
    if (!supabase) throw new Error('supabase client missing');
    const { data, error } = await supabase
      .from('agents')
      .select('id,name,region,present,pto')
      .eq('region', region)
      .order('name', { ascending:true });
    if (error) throw error;
    if (!data?.length) {
      console.warn('[planning] no agents from DB for', region);
      return [];
    }
    return data.map(a=>({
      id:a.id, name:a.name, region:a.region,
      present: a.present ?? [true,true,true,true,true,false,false],
      pto: a.pto ?? [false,false,false,false,false,false,false]
    }));
  }catch(e){
    console.warn('[planning] supabase agents error:', e.message);
    return ROMAN.store.agents || []; // fallback éventuel local
  }
}

async function runOptimize(){
  const regionSel = byId('selRegion');
  const region = regionSel?.value || ROMAN.store.region || 'Europe';

  // 1) garantir tasks/forecast
  ensureTasksDefaults();
  ensureForecastDefaults();

  // 2) charger agents (DB) → store
  const agents = await fetchAgentsForRegion(region);
  if (agents.length) ROMAN.store.agents = agents;

  // 3) lancer l'optimiseur
  if (typeof ROMAN.optimize === 'function'){
    ROMAN.optimize(region);
  } else {
    alert('Optimizer not initialized');
  }

  // 4) re-render le planner si dispo
  if (typeof window.renderPlanner === 'function') window.renderPlanner();
}

function wireButtons(){
  const btn = byId('btnOptimize');
  if (btn){
    btn.addEventListener('click', async ()=>{
      btn.disabled = true; btn.textContent='Optimizing…';
      await runOptimize();
      btn.disabled = false; btn.textContent='Optimize';
    });
  }
  // Clear/Export restent comme avant (leur logique vit déjà dans ton HTML inline)
}

export function initPlanning(){
  // Peuplage des select si nécessaire (déjà fait par ton code inline)
  // On garde ROMAN.store.region en phase
  const rSel = byId('selRegion');
  if (rSel) rSel.addEventListener('change', ()=> ROMAN.store.region = rSel.value);

  // run initial (optionnel) : on ne lance pas auto pour éviter d’écraser ton mock
  wireButtons();
}

