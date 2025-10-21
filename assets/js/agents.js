// public/js/agents.js
const SUPABASE_URL = 'https://zllfthitcgexvvumxxpu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbGZ0aGl0Y2dleHZ2dW14eHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTkyMzQsImV4cCI6MjA3NjQ3NTIzNH0.oXi1IhdQev1Xjy75UsZ_Kejocp3ZgdKclMqsVLSNeG4';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

async function loadAgents() {
  const tableBody = $('#agents-table tbody');
  const counterEl = $('#agents-count');
  const regionFilter = $('#region-filter');

  tableBody.innerHTML = `<tr><td colspan="4" style="padding:12px;text-align:center;">Chargement…</td></tr>`;

  const region = regionFilter?.value || null;

  let query = supabase
    .from('agents')
    .select('id, full_name, region, active, skills')
    .order('full_name', { ascending: true });

  if (region && region !== 'ALL') {
    query = query.eq('region', region);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Erreur Supabase:', error);
    tableBody.innerHTML = `<tr><td colspan="4" style="color:#b91c1c;padding:12px;">Erreur de chargement (voir console)</td></tr>`;
    counterEl.textContent = '0';
    return;
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" style="padding:12px;text-align:center;">Aucun agent</td></tr>`;
    counterEl.textContent = '0';
    return;
  }

  const rows = data.map(a => {
    const skillsText =
      a.skills && Object.keys(a.skills).length
        ? Object.entries(a.skills).map(([k, v]) => `${k}: ${v}`).join(', ')
        : '—';
    return `
      <tr data-id="${a.id}">
        <td>${a.full_name}</td>
        <td>${a.region}</td>
        <td>${a.active ? 'Active' : 'Inactive'}</td>
        <td>${skillsText}</td>
      </tr>
    `;
  }).join('');

  tableBody.innerHTML = rows;
  counterEl.textContent = String(data.length);
}

function wireEvents() {
  const regionFilter = $('#region-filter');
  if (regionFilter) {
    regionFilter.addEventListener('change', () => loadAgents());
  }

  const thName = $('#th-name');
  if (thName) {
    let asc = true;
    thName.style.cursor = 'pointer';
    thName.addEventListener('click', () => {
      const tableBody = $('#agents-table tbody');
      const rows = $$('#agents-table tbody tr');
      const sorted = rows.sort((a, b) => {
        const an = a.children[0].textContent.toLowerCase();
        const bn = b.children[0].textContent.toLowerCase();
        return asc ? an.localeCompare(bn) : bn.localeCompare(an);
      });
      asc = !asc;
      tableBody.innerHTML = '';
      sorted.forEach(r => tableBody.appendChild(r));
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAgents();
  wireEvents();
});

