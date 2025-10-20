// assets/js/auth.js
import { supabase } from './supabase.js';

// État courant (simple)
export const Auth = {
  user: null,        // Supabase user (ou null)
  region: null,      // "Europe", ... ou "Admin"
  email: null
};

const ALL_REGIONS = ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];
function regionsForUser(){
  if (Auth.region === 'Admin') return ['Europe','Americas','Greater China','Japan','South Korea','SEAO'];
  if (ALL_REGIONS.includes(Auth.region)) return [Auth.region];
  return ['Europe']; // fallback par défaut
}

// Helpers DOM
function $(sel){ return document.querySelector(sel); }

// ----- UI: injecter / montrer la modale -----
function ensureAuthModal(){
  if ($('#authModal')) return;
  const el = document.createElement('div');
  el.id = 'authModal';
  el.style.position='fixed';
  el.style.inset='0';
  el.style.display='none';
  el.style.background='rgba(0,0,0,0.35)';
  el.style.zIndex='999';
  el.innerHTML = `
    <div style="max-width:420px;margin:8% auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px">
      <h3 style="margin:0 0 8px 0">Sign in / Sign up</h3>
      <p class="muted" style="margin:0 0 12px 0">Crée un compte avec ta région, ou connecte-toi si tu en as déjà un.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="authEmail" class="input" placeholder="email@exemple.com" style="flex:1;min-width:220px"/>
        <input id="authPwd" class="input" placeholder="Password (min 6)" type="password" style="flex:1;min-width:160px"/>
      </div>
      <div style="margin-top:10px">
        <label class="label">Région (pour création de compte) :</label>
        <select id="authRegion" class="select">
          <option>Europe</option>
          <option>Americas</option>
          <option>Greater China</option>
          <option>Japan</option>
          <option>South Korea</option>
          <option>SEAO</option>
          <option>Admin</option>
        </select>
      </div>
      <div class="row" style="justify-content:flex-end;margin-top:14px;gap:8px">
        <button id="btnCloseAuth" class="btn ghost">Cancel</button>
        <button id="btnDoSignin" class="btn">Sign in</button>
        <button id="btnDoSignup" class="btn">Create account</button>
      </div>
      <div id="authNote" class="muted" style="margin-top:8px;font-size:12px"></div>
    </div>
  `;
  document.body.appendChild(el);

  $('#btnCloseAuth').addEventListener('click', hideAuthModal);
  $('#btnDoSignin').addEventListener('click', onSignIn);
  $('#btnDoSignup').addEventListener('click', onSignUp);
}

function showAuthModal(){
  ensureAuthModal();
  $('#authModal').style.display = 'block';
}

function hideAuthModal(){
  const m = $('#authModal');
  if (m) m.style.display = 'none';
}

// ----- Actions -----
async function onSignUp(){
  const email = $('#authEmail').value.trim();
  const password = $('#authPwd').value;
  const region = $('#authRegion').value;

  $('#authNote').textContent = 'Creating account…';
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) { $('#authNote').textContent = 'Sign up error: ' + error.message; return; }

  // Créer le profil avec la région choisie
  const userId = data.user?.id;
  if (userId){
    await supabase.from('profiles').insert([{ id:userId, email, region }]);
  }
  $('#authNote').textContent = 'Account created. Check your inbox if email confirmation is enabled.';
}

async function onSignIn(){
  const email = $('#authEmail').value.trim();
  const password = $('#authPwd').value;

  $('#authNote').textContent = 'Signing in…';
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { $('#authNote').textContent = 'Sign in error: ' + error.message; return; }

  await loadProfileAndApply();
  hideAuthModal();
}

// Récupère le profil (région) et ajuste l’UI
async function loadProfileAndApply(){
  const { data: { user } } = await supabase.auth.getUser();
  Auth.user = user || null;
  Auth.email = user?.email || null;
  Auth.region = null;

  if (user){
    const { data: rows } = await supabase
      .from('profiles')
      .select('region,email')
      .eq('id', user.id)
      .limit(1);
    if (rows && rows[0]){
      Auth.region = rows[0].region;
      Auth.email  = rows[0].email || Auth.email;
    }
  }

  // Header: afficher statut
  const hdr = document.getElementById('authStatus');
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  if (Auth.user){
    hdr.textContent = `${Auth.email} — ${Auth.region || 'No region'}`;
    if (btnLogin) btnLogin.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-block';
  } else {
    hdr.textContent = 'Not signed in';
    if (btnLogin) btnLogin.style.display = 'inline-block';
    if (btnLogout) btnLogout.style.display = 'none';
  }

  // Restreindre l’UI par région (Landing/Forecast/…)
  applyRegionVisibility();
}

// Déconnexion
export async function signOut(){
  await supabase.auth.signOut();
  Auth.user = null; Auth.region = null; Auth.email = null;
  await loadProfileAndApply();
}

// ----- Filtrage UI par région -----
// Idée simple : on garde la même app, mais on limite les régions dans les sélecteurs et les blocs affichés.
function applyRegionVisibility(){
  const allowed = regionsForUser(); // tableau 1 région ou 6 si Admin

  // 1) Landing: limiter le <select id="selRegion">
  const sel = document.getElementById('selRegion');
  if (sel){
    const current = sel.value;
    sel.innerHTML = '';
    allowed.forEach(r=>{
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      sel.appendChild(opt);
    });
    // si l’ancienne valeur n’est pas permise, on bascule sur la 1ère
    if (!allowed.includes(current)) sel.value = allowed[0];
    // déclencher re-render si dispo
    if (typeof window.renderPlanner === 'function') window.renderPlanner();
  }

  // 2) Forecast: masquer/montrer les blocs régionaux
  // - Totals & Task split: on ne reconstruit pas tout, on masque les lignes non permises
  const regionCells = document.querySelectorAll('#fcRegionTotals tbody tr, #fcTaskSplitBody tr');
  regionCells.forEach(tr=>{
    const r = tr.firstElementChild?.textContent?.trim();
    tr.style.display = allowed.includes(r) ? '' : 'none';
  });

  // - Weekly: masquer les colonnes non permises (hors "Week" and "Row total")
  const head = document.getElementById('fcWeeklyHead');
  const body = document.getElementById('fcWeeklyBody');
  if (head && body){
    const headers = Array.from(head.querySelectorAll('th'));
    headers.forEach((th, idx)=>{
      if (idx===0 || idx===headers.length-1) return; // Week / Row total
      const r = th.textContent.trim();
      const show = allowed.includes(r);
      th.style.display = show ? '' : 'none';
      // cacher même index dans chaque row
      body.querySelectorAll('tr').forEach(tr=>{
        const td = tr.children[idx];
        if (td) td.style.display = show ? '' : 'none';
      });
    });
  }

  // - Hourly blocs par région (cartes)
  document.querySelectorAll('#fcHourlyBlocks .card').forEach(card=>{
    const title = card.querySelector('h4')?.textContent?.trim();
    card.style.display = allowed.includes(title) ? '' : 'none';
  });

  // 3) Agents: limiter la liste déroulante "Region" dans le roster si pas Admin (optionnel)
  if (Auth.region !== 'Admin'){
    document.querySelectorAll('#agRoster select').forEach(sel=>{
      if (sel.tagName==='SELECT'){
        // si c’est le select de région d’un agent :
        if ([...sel.options].some(o => o.value==='Europe' && o.textContent==='Europe')){
          // on force la région unique autorisée
          const val = allowed[0];
          sel.innerHTML = `<option value="${val}">${val}</option>`;
        }
      }
    });
  }

  // 4) Badge header (déjà fait via loadProfileAndApply)
}

// ----- Public -----
export function initAuthUI(){
  // Boutons header
  const btnLogin = document.getElementById('btnLogin');
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogin) btnLogin.addEventListener('click', showAuthModal);
  if (btnLogout) btnLogout.addEventListener('click', signOut);

  ensureAuthModal();

  // Session courante (si déjà loggé)
  supabase.auth.onAuthStateChange(async (_event, _session) => {
    await loadProfileAndApply();
  });
  // premier affichage
  loadProfileAndApply();
}

// Expose utilitaire pour d’autres modules
export function getAllowedRegions(){
  return regionsForUser();
}
export function isAdmin(){ return Auth.region === 'Admin'; }
