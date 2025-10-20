/***** 0) CONFIG — REMPLACE CES 2 VALEURS *****/
const SUPABASE_URL = "https://zllfthitcgexvvumxxpu.supabase.co";   // Settings > API > Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbGZ0aGl0Y2dleHZ2dW14eHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTkyMzQsImV4cCI6MjA3NjQ3NTIzNH0.oXi1IhdQev1Xjy75UsZ_Kejocp3ZgdKclMqsVLSNeG4";          // Settings > API > anon public key
const ACCESS_CODE = "roman123";                     // petit code d'accès souple
/*************************************************/

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------- UI elements ---------- */
const gate = document.getElementById('gate');
const gateMsg = document.getElementById('gateMsg');
const accessCode = document.getElementById('accessCode');
const enterBtn = document.getElementById('enterBtn');

const authBox = document.getElementById('auth');
const emailEl = document.getElementById('email');
const passEl = document.getElementById('password');
const authMsg = document.getElementById('authMsg');
const loginBtn = document.getElementById('login');
const signupBtn = document.getElementById('signup');

const appBox = document.getElementById('app');
const logoutBtn = document.getElementById('logout');

const weekInput = document.getElementById('weekInput');
const yearInput = document.getElementById('yearInput');
const daySelect = document.getElementById('daySelect');
const agentSelect = document.getElementById('agentSelect');
const refreshBtn = document.getElementById('refresh');
const addShiftBtn = document.getElementById('addShift');
const agentNameEl = document.getElementById('agentName');
const startTimeEl = document.getElementById('startTime');
const endTimeEl = document.getElementById('endTime');
const formMsg = document.getElementById('formMsg');
const planningBody = document.getElementById('planningBody');
const rangeLabel = document.getElementById('rangeLabel');

/* ---------- 0) Porte d'accès souple ---------- */
enterBtn.onclick = () => {
  if (accessCode.value.trim() === ACCESS_CODE) {
    gate.classList.add('hide');
    authBox.classList.remove('hide');
  } else {
    gateMsg.textContent = "Code incorrect.";
  }
};

/* ---------- 1) Helpers ISO week ---------- */
function getISOWeek(date){
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(),0,1));
  return Math.ceil((((tmp - yearStart) / 86400000) + 1)/7);
}
function firstDateOfISOWeek(week, year){
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = new Date(simple);
  if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - dow + 1);
  else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - dow);
  return ISOweekStart;
}
function fmtDate(d){ return d.toISOString().slice(0,10); }

/* ---------- 2) Auth Supabase ---------- */
loginBtn.onclick = async () => {
  authMsg.textContent = "";
  const { error } = await sb.auth.signInWithPassword({
    email: emailEl.value.trim(),
    password: passEl.value
  });
  if (error){ authMsg.textContent = error.message; return; }
  showApp();
};

signupBtn.onclick = async () => {
  authMsg.textContent = "";
  const { error } = await sb.auth.signUp({
    email: emailEl.value.trim(),
    password: passEl.value
  });
  authMsg.textContent = error ? error.message : "Compte créé. Connecte-toi.";
};

logoutBtn.onclick = async () => {
  await sb.auth.signOut();
  appBox.classList.add('hide');
  authBox.classList.remove('hide');
};

/* ---------- 3) Data helpers ---------- */
async function ensureAgent(name){
  const { data: found, error: findErr } = await sb.from('agents').select('id').eq('full_name', name).maybeSingle();
  if (findErr) throw findErr;
  if (found?.id) return found.id;

  const { data: created, error: insErr } = await sb.from('agents').insert({ full_name: name }).select().single();
  if (insErr) throw insErr;
  return created.id;
}

async function loadAgentsIntoSelect(){
  const { data, error } = await sb.from('agents').select('id, full_name').order('full_name', { ascending: true });
  agentSelect.innerHTML = "";
  if (error){
    agentSelect.innerHTML = `<option value="">(erreur chargement)</option>`;
    return;
  }
  agentSelect.innerHTML = `<option value="">— choisir un agent —</option>`;
  data.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.full_name; // on stocke le nom (simple pour l’instant)
    opt.textContent = a.full_name;
    agentSelect.appendChild(opt);
  });
}

/* ---------- 4) App (planning) ---------- */
refreshBtn.onclick = () => loadWeek();

addShiftBtn.onclick = async () => {
  formMsg.textContent = "";

  // priorite: nom dans le select; sinon champ texte
  const candidate = agentSelect.value || agentNameEl.value.trim();
  if (!candidate){ formMsg.textContent = "Choisis un agent ou tape un nom."; return; }

  try {
    const agentId = await ensureAgent(candidate);
    const day = daySelect.value;

    const { error: shiftErr } = await sb.from('shifts').insert({
      agent_id: agentId,
      day,
      start_time: startTimeEl.value,
      end_time: endTimeEl.value
    });
    if (shiftErr){ formMsg.textContent = shiftErr.message; return; }

    agentNameEl.value = "";
    formMsg.textContent = "Shift ajouté.";
    await loadWeek();
    await loadAgentsIntoSelect(); // au cas où un nouveau nom a été créé
  } catch(e){
    formMsg.textContent = e.message || String(e);
  }
};

async function showApp(){
  const today = new Date();
  yearInput.value = today.getFullYear();
  weekInput.value = getISOWeek(today);
  fillDays();

  authBox.classList.add('hide');
  appBox.classList.remove('hide');

  await loadAgentsIntoSelect();
  await loadWeek();
}

function fillDays(){
  const y = parseInt(yearInput.value,10);
  const w = parseInt(weekInput.value,10);
  const start = firstDateOfISOWeek(w, y);
  const labels = [];
  daySelect.innerHTML = "";
  for (let i=0;i<7;i++){
    const d = new Date(start); d.setUTCDate(start.getUTCDate()+i);
    const opt = document.createElement('option');
    opt.value = fmtDate(d);
    opt.textContent = d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'2-digit' });
    daySelect.appendChild(opt);
    labels.push(fmtDate(d));
  }
  rangeLabel.textContent = `${labels[0]} → ${labels[6]}`;
}

async function loadWeek(){
  fillDays();
  const y = parseInt(yearInput.value,10);
  const w = parseInt(weekInput.value,10);
  const start = firstDateOfISOWeek(w, y);
  const end = new Date(start); end.setUTCDate(start.getUTCDate()+6);

  const { data, error } = await sb
    .from('shifts')
    .select('id, day, start_time, end_time, agents(full_name)')
    .gte('day', fmtDate(start))
    .lte('day', fmtDate(end))
    .order('day', { ascending: true });

  if (error){
    planningBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    return;
  }

  if (!data || data.length===0){
    planningBody.innerHTML = `<tr><td colspan="5" class="muted">Aucun shift.</td></tr>`;
    return;
  }

  planningBody.innerHTML = data.map(row => `
    <tr>
      <td>${row.day}</td>
      <td>${row.agents?.full_name || '—'}</td>
      <td>${row.start_time}</td>
      <td>${row.end_time}</td>
      <td><button onclick="delShift('${row.id}')">Supprimer</button></td>
    </tr>
  `).join('');
}

window.delShift = async (id) => {
  const { error } = await sb.from('shifts').delete().eq('id', id);
  if (error){ alert(error.message); return; }
  loadWeek();
};

/* ---------- 5) Auto-connexion si session déjà présente ---------- */
sb.auth.getSession().then(({ data }) => {
  if (data.session) {
    gate.classList.add('hide');
    showApp();
  }
});
