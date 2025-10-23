// assets/js/agent-ui.js
import { fetchAgents } from './agent.js';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export async function initAgentsDirectory() {
  // Ces éléments doivent exister dans le HTML (on les ajoute à l'étape 4)
  const countEl  = $('#agents-count');
  const regionEl = $('#region-filter');
  const tbody    = $('#agents-table tbody');

  // Si le bloc n'existe pas encore, on ne fait rien (sécurité)
  if (!countEl || !regionEl || !tbody) return;

  async function render() {
    tbody.innerHTML = `<tr><td colspan="4" style="padding:12px;text-align:center;">Loading…</td></tr>`;
    try {
      const rows = await fetchAgents(regionEl.value);
      countEl.textContent = String(rows.length);

      if (!rows.length) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding:12px;text-align:center;">No agents</td></tr>`;
        return;
      }

      tbody.innerHTML = rows.map(a => `
        <tr>
          <td>${a.full_name}</td>
          <td>${a.region}</td>
          <td>${a.active ? 'Active' : 'Inactive'}</td>
          <td>${formatSkills(a.skills)}</td>
        </tr>
      `).join('');
    } catch (e) {
      console.error('Agents load error:', e);
      tbody.innerHTML = `<tr><td colspan="4" style="padding:12px;color:#b91c1c;">Error loading agents (see console)</td></tr>`;
      countEl.textContent = '0';
    }
  }

  function formatSkills(skills) {
    if (!skills || typeof skills !== 'object' || !Object.keys(skills).length) return '—';
    return Object.entries(skills).map(([k, v]) => `${k}: ${v}`).join(', ');
  }

  regionEl.addEventListener('change', render);
  await render();
}

// Lance automatiquement quand la page est prête
document.addEventListener('DOMContentLoaded', initAgentsDirectory);


