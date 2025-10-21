// assets/js/agents-ui.js
let supabase = window.supabase;
async function ensureSupabase() {
  if (supabase) return supabase;
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  const url = window.SUPABASE_URL || window.SUPABASE_URL_PUBLIC || window.SUPABASE_URL_BASE;
  const key = window.SUPABASE_ANON_KEY || window.SUPABASE_PUBLIC_ANON_KEY;
  if (!url || !key) {
    console.warn('[AgentsUI] SUPABASE_URL / SUPABASE_ANON_KEY manquants. Lecture/écriture désactivées.');
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

const SKILL_KEYS = [
  'Call','Mail','Chat','Clienteling','Fraud',
  'Back Office','Lunch Break','Break','Morning Brief','Training'
];
function defaultSkills(){ const s={}; SKILL_KEYS.forEach(k=>s[k]=true); return s; }

const $=(s,r=document)=>r.querySelector(s);
function el(tag, attrs={}, html){ const e=document.createElement(tag); Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v)); if(html!==undefined) e.innerHTML=html; return e; }

const REGIONS=['Europe','Americas','Greater China','Japan','South Korea','SEAO'];
let CURRENT_REGION='Europe';
let AGENTS_CACHE=[];
let PTO_CACHE=new Map();
const ymd=d=>d.toISOString().slice(0,10);
const addDays=(d,n)=>{const x=new Date(d); x.setDate(x.getDate()+n); return x;};

function closePtoDrawer(){ $('#ptoOverlay')?.remove(); }
function openPtoDrawer(agent){
  closePtoDrawer();
  const overlay=el('div',{class:'drawer-overlay',id:'ptoOverlay'});
  const drawer=el('div',{class:'drawer-panel',id:'ptoDrawer'});
  const title=el('div',{class:'drawer-title'},`PTO — ${agent.full_name}`);
  const form=el('div',{class:'drawer-form'});
  const r1=el('div',{class:'drawer-row'}); r1.innerHTML=`<label>Start date</label><input type="date" id="ptoStart">`;
  const r2=el('div',{class:'drawer-row'}); r2.innerHTML=`<label>End date</label><input type="date" id="ptoEnd">`;
  const r3=el('div',{class:'drawer-row'}); r3.innerHTML=`<label>Half day</label><select id="ptoHalf"><option value="FULL">FULL (all day)</option><option value="AM">AM</option><option value="PM">PM</option></select>`;
  const r4=el('div',{class:'drawer-row'}); r4.innerHTML=`<label>Note</label><input type="text" id="ptoNote" placeholder="optional note">`;
  const actions=el('div',{class:'drawer-actions'});
  const bSave=el('button',{class:'btn'},'Save PTO');
  const bCancel=el('button',{class:'btn ghost'},'Cancel');
  bCancel.addEventListener('click',closePtoDrawer);
  bSave.addEventListener('click',async()=>{
    const sb=await ensureSupabase(); if(!sb){ alert('Supabase not ready'); return; }
    const s=$('#ptoStart')?.value; const e=$('#ptoEnd')?.value||s; const half=$('#ptoHalf')?.value||'FULL'; const note=$('#ptoNote')?.value||null;
    if(!s){ alert('Pick a start date'); return; }
    const d0=new Date(s), d1=new Date(e); if(isNaN(d0)||isNaN(d1)||d1<d0){ alert('Date range invalid'); return; }
    const rows=[]; for(let d=new Date(d0); d<=d1; d=addDays(d,1)){ rows.push({agent_id:agent.id,date:ymd(d),half_day:half,note}); }
    const {error}=await sb.from('agent_pto').upsert(rows,{onConflict:'agent_id,date,half_day'});
    if(error){ console.error(error); alert('PTO save failed'); } else { await loadPtoForAgent(agent.id); alert('PTO saved ✔'); closePtoDrawer(); }
  });
  actions.append(bSave,bCancel);
  form.append(r1,r2,r3,r4,actions);
  drawer.append(title,form); overlay.append(drawer); document.body.append(overlay);
  overlay.addEventListener('click',(e)=>{ if(e.target===overlay) closePtoDrawer(); });
}

function closePtoCalendar(){ $('#ptoCalOverlay')?.remove(); }
function openPtoCalendar(agent){
  closePtoCalendar();
  const overlay=el('div',{class:'modal-overlay',id:'ptoCalOverlay'});
  const modal=el('div',{class:'modal',id:'ptoCalModal'});
  const title=el('div',{class:'modal-title'},`PTO — next 28 days — ${agent.full_name}`);
  const grid=el('div',{class:'calendar-grid'});
  const start=new Date(); start.setHours(0,0,0,0);
  for(let i=0;i<28;i++){
    const d=addDays(start,i); const keyF=`${ymd(d)}:FULL`, keyA=`${ymd(d)}:AM`, keyP=`${ymd(d)}:PM`;
    const cell=el('div',{class:'calendar-cell'}); const label=el('div',{class:'cell-date'},d.toLocaleDateString(undefined,{month:'short',day:'numeric'}));
    const set=PTO_CACHE.get(agent.id);
    const hasF=set?.has(keyF); const hasA=set?.has(keyA); const hasP=set?.has(keyP);
    if(hasF){ cell.classList.add('pto-full'); }
    else if(hasA||hasP){ cell.classList.add('pto-half'); const sub=el('div',{class:'cell-half-tag'}, hasA&&hasP?'AM+PM':(hasA?'AM':'PM')); cell.append(sub);}
    cell.append(label); grid.append(cell);
  }
  const actions=el('div',{class:'modal-actions'}); const bClose=el('button',{class:'btn'},'Close'); bClose.addEventListener('click',closePtoCalendar);
  actions.append(bClose); modal.append(title,grid,actions); overlay.append(modal); document.body.append(overlay);
  overlay.addEventListener('click',(e)=>{ if(e.target===overlay) closePtoCalendar(); });
}

async function loadAgents(region){
  const sb=await ensureSupabase(); if(!sb){ AGENTS_CACHE=[]; return []; }
  let q=sb.from('agents').select('id, full_name, region, skills, active').order('full_name',{ascending:true});
  if(region) q=q.eq('region',region);
  const {data,error}=await q; if(error){ console.error('[AgentsUI] loadAgents',error); AGENTS_CACHE=[]; return []; }
  AGENTS_CACHE=data||[]; return AGENTS_CACHE;
}
async function loadPtoForAgent(agentId){
  const sb=await ensureSupabase(); if(!sb) return;
  const start=new Date(); start.setHours(0,0,0,0); const end=addDays(start,60);
  const {data,error}=await sb.from('agent_pto').select('date,half_day').eq('agent_id',agentId).gte('date',ymd(start)).lte('date',ymd(end));
  if(error){ console.error('[AgentsUI] loadPTO',error); return; }
  const set=new Set(); (data||[]).forEach(r=>set.add(`${r.date}:${r.half_day}`)); PTO_CACHE.set(agentId,set);
}
async function loadPtoForAgents(ids){
  const sb=await ensureSupabase(); if(!sb||!ids.length) return;
  const start=new Date(); start.setHours(0,0,0,0); const end=addDays(start,60);
  const {data,error}=await sb.from('agent_pto').select('agent_id,date,half_day').in('agent_id',ids).gte('date',ymd(start)).lte('date',ymd(end));
  if(error){ console.error('[AgentsUI] loadPTO',error); return; }
  PTO_CACHE.clear(); (data||[]).forEach(r=>{ if(!PTO_CACHE.has(r.agent_id)) PTO_CACHE.set(r.agent_id,new Set()); PTO_CACHE.get(r.agent_id).add(`${r.date}:${r.half_day}`); });
}

async function upsertAgent(agent){
  const sb=await ensureSupabase(); if(!sb) return {error:new Error('No Supabase')};
  const merged={...defaultSkills(), ...(agent.skills||{})};
  const payload={ id:agent.id, full_name:agent.full_name, region:agent.region||CURRENT_REGION, active: agent.active??true, skills: merged };
  const {data,error}=await sb.from('agents').upsert(payload).select().limit(1).single();
  if(!error && data?.id) agent.id=data.id;
  return {data,error};
}
async function deleteAgent(agentId){
  const sb=await ensureSupabase(); if(!sb) return {error:new Error('No Supabase')};
  const {error}=await sb.from('agents').delete().eq('id',agentId); return {error};
}

function cardTitle(t){ return el('h4',{style:'margin:0 0 8px 0'},t); }
function descr(t){ return el('div',{class:'muted',style:'margin-bottom:6px'},t); }

function buildAgentsSectionRoot(){
  const host=document.getElementById('tab-Agents'); host.innerHTML='';
  const head=el('div',{class:'row',style:'margin-bottom:8px'});
  const lab=el('label',{class:'muted'},'Region:');
  const sel=el('select',{class:'input',id:'agRegionFilter'});
  REGIONS.forEach(r=>{ const o=el('option'); o.value=r; o.textContent=r; if(r===CURRENT_REGION) o.selected=true; sel.append(o); });
  const bAdd=el('button',{class:'btn',id:'agAdd'},'Add agent');
  const bExp=el('button',{class:'btn ghost',id:'agExport'},'Export CSV');
  const badge=el('span',{class:'badge',id:'agCount',style:'margin-left:auto'},'0 agents');
  head.append(lab,sel,bAdd,bExp,badge);

  const card=el('div',{class:'card',style:'padding:12px;margin:12px 0'});
  const tableWrap=el('div',{class:'scroll-x'});
  const table=el('table',{id:'agMatrix'});
  const thead=el('thead'); const tr=el('tr');
  tr.append(el('th',{},'Agent'));
  SKILL_KEYS.forEach(sk=>{ const th=el('th',{class:'th-rotate'}); const inner=el('div',{class:'rotate'},sk); th.append(inner); tr.append(th); });
  tr.append(el('th',{},'PTO'),el('th',{},'Calendar'),el('th',{},'Delete'));
  thead.append(tr);
  const tbody=el('tbody');
  table.append(thead,tbody); tableWrap.append(table);
  card.append(cardTitle('A. Agents & skills'), descr('All skills are ON by default. Uncheck to opt out.'), tableWrap);
  host.append(head,card);
}

function renderAgentRows(){
  const tbody=document.querySelector('#agMatrix tbody'); tbody.innerHTML='';
  const frag=document.createDocumentFragment();
  AGENTS_CACHE.forEach(agent=>{
    const tr=el('tr');
    const tdName=el('td'); const inp=el('input',{class:'input', value:agent.full_name});
    inp.addEventListener('change', async()=>{ agent.full_name=inp.value.trim()||agent.full_name; const {error}=await upsertAgent(agent); if(error){ alert('Save failed'); console.error(error);} });
    tdName.append(inp); tr.append(tdName);

    const skills={...defaultSkills(), ...(agent.skills||{})};
    SKILL_KEYS.forEach(key=>{
      const td=el('td',{class:'mono',style:'text-align:center'});
      const chk=el('input',{type:'checkbox'}); chk.checked=!!skills[key];
      chk.addEventListener('change', async()=>{ agent.skills={...skills,[key]:chk.checked}; const {error}=await upsertAgent(agent); if(error){ alert('Save failed'); console.error(error);} });
      td.append(chk); tr.append(td);
    });

    const tdP=el('td'); const bP=el('button',{class:'btn ghost'},'PTO'); bP.addEventListener('click',()=>openPtoDrawer(agent)); tdP.append(bP); tr.append(tdP);
    const tdC=el('td'); const bC=el('button',{class:'btn ghost'},'Calendar'); bC.addEventListener('click',()=>openPtoCalendar(agent)); tdC.append(bC); tr.append(tdC);

    const tdD=el('td'); const bD=el('button',{class:'btn ghost'},'Delete');
    bD.addEventListener('click', async()=>{ if(!confirm(`Delete ${agent.full_name}?`)) return; const {error}=await deleteAgent(agent.id); if(error){ alert('Delete failed'); console.error(error); return; } await refreshAgents(); });
    tdD.append(bD); tr.append(tdD);

    frag.append(tr);
  });
  tbody.append(frag);
  const badge=document.getElementById('agCount'); if(badge) badge.textContent=`${AGENTS_CACHE.length} agents`;
}

async function refreshAgents(){ await loadAgents(CURRENT_REGION); const ids=AGENTS_CACHE.map(a=>a.id); await (ids.length?loadPtoForAgents(ids):Promise.resolve()); renderAgentRows(); }

function wireAgentsUI(){
  document.getElementById('agAdd')?.addEventListener('click', async()=>{
    const name=prompt('Agent full name:'); if(!name) return;
    const agent={ full_name:name.trim(), region:CURRENT_REGION, active:true, skills: defaultSkills() };
    const {error}=await upsertAgent(agent); if(error){ alert('Insert failed'); console.error(error); return; }
    await refreshAgents();
  });
  document.getElementById('agExport')?.addEventListener('click', ()=>{
    const headers=['full_name', ...SKILL_KEYS.map(k=>`skill_${k.replace(/\s+/g,'_').toLowerCase()}`)];
    const lines=[headers.join(',')];
    AGENTS_CACHE.forEach(a=>{ const sk={...defaultSkills(), ...(a.skills||{})}; const row=[JSON.stringify(a.full_name), ...SKILL_KEYS.map(k=>sk[k]?'1':'0')]; lines.push(row.join(',')); });
    const blob=new Blob([lines.join('\n')],{type:'text/csv'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`agents-${CURRENT_REGION}.csv`; a.click(); URL.revokeObjectURL(a.href);
  });
  document.getElementById('agRegionFilter')?.addEventListener('change', async(e)=>{ CURRENT_REGION=e.target.value; await refreshAgents(); });
}

export async function initAgentsUI(){
  const host=document.getElementById('tab-Agents'); if(!host) return;
  CURRENT_REGION = (window.ROMAN?.store?.region && REGIONS.includes(window.ROMAN.store.region)) ? window.ROMAN.store.region : 'Europe';
  buildAgentsSectionRoot();
  wireAgentsUI();
  await refreshAgents();
}

document.addEventListener('DOMContentLoaded', ()=>{ const el=document.getElementById('tab-Agents'); if(el && el.style.display!=='none'){ initAgentsUI(); }});

