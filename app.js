// 0) RENSEIGNE TES CLES
const SUPABASE_URL = "https://xxxxx.supabase.co";       // <- remplace
const SUPABASE_ANON_KEY = "eyJhbGciOi...";              // <- remplace

// 1) Init
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2) Eléments UI
const authBox = document.getElementById('auth');
const appBox = document.getElementById('app');
const msg = document.getElementById('authMsg');
const formMsg = document.getElementById('formMsg');

const weekInput = document.getElementById('weekInput');
const yearInput = document.getElementById('yearInput');
const daySelect = document.getElementById('daySelect');
const planningBody = document.getElementById('planningBody');
const rangeLabel = document.getElementById('rangeLabel');

// 3) Helpers semaine ISO
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
  const ISOweekStart = simple;
  if (dow <= 4) ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  else ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  return ISOweekStart;
}
function fmtDate(d){ return d.toISOString().slice(0,10); }

// 4) Auth actions
document.getElementById('login').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await sb.auth.signInWithPassword({ email, password });
  msg.textContent = error ? error.message : "Connecté.";
  if (!error) await showApp();
};

document.getElementById('signup').onclick = async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const { error } = await sb.auth.signUp({ email, password });
  msg.textContent = error ? error.message : "Compte créé. Vérifie ta boîte mail si la confirmation est activée.";
};

document.getElementById('logout').onclick = async () => {
  await sb.auth.signOut();
  appBox.classList.add('hide');
  authBox.classList.remove('hide');
};

// 5) App logic
document.getElementById('refresh').onclick = () => loadWeek();

document.getElementById('addShift').onclick = async () => {
  formMsg.textContent = "";
  const name = document.getElementById('agentName').value.trim();
  const day = daySelect.value; // ISO yyyy-mm-dd
  const start = document.getElementById('startTime').value;
  const end = document.getElementById('endTime').value;

  if (!name) { formMsg.textContent = "Nom d’agent obligatoire."; return; }

  // créer l'agent s'il n'existe pas
  let agentId;
  const { data: agentFound } = await sb.from('agents').select('id').eq('full_name', name).maybeSingle();
  if (agentFound?.id) {
    agentId = agentFound.id;
  } else {
    const { data: newAgent, error: aerr } = await sb.from('agents').insert({ full_name: name }).select().single();
    if (aerr) { formMsg.textContent = aerr.message; return; }
    agentId = newAgent.id;
  }

  const { error: serr } = await sb.from('shifts').insert({
    agent_id: agentId, day, start_time: start, end_time: end
  });
  if (serr) { formMsg.textContent = serr.message; return; }

  formMsg.textContent = "Shift ajouté.";
  loadWeek();
};

async function showApp(){
  authBox.classList.add('hide');
  appBox.classList.remove('hide');

  // Préremplir semaine/année/jours
  const today = new Date();
  yearInput.value = today.getFullYear();
  weekInput.value = getISOWeek(today);
  fillDays();
  await loadWeek();
}

function fillDays(){
  const y = parseInt(yearInput.value,10);
  const w = parseInt(weekInput.value,10);
  const start = firstDateOfISOWeek(w, y);
  daySelect.innerHTML = "";
  const labels = [];
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

  if (error){ planningBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`; return; }

  if (!data || data.length===0){
    planningBody.innerHTML = `<tr><td colspan="5" class="muted">Aucun shift pour cette semaine.</td></tr>`;
    return;
  }

  planningBody.innerHTML = data.map(row => {
    const name = row.agents?.full_name || '—';
    return `<tr>
      <td>${row.day}</td>
      <td>${name}</td>
      <td>${row.start_time}</td>
      <td>${row.end_time}</td>
      <td><button onclick="delShift('${row.id}')">Supprimer</button></td>
    </tr>`;
  }).join('');
}

// suppression simple
window.delShift = async (id) => {
  const { error } = await sb.from('shifts').delete().eq('id', id);
  if (error){ alert(error.message); return; }
  loadWeek();
};

// garder la session si déjà connecté
sb.auth.getSession().then(({ data }) => { if (data.session) showApp(); });
