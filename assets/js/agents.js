// assets/js/agent.js
import { supabase } from './supabase.js';

export async function fetchAgents(regionValue) {
  let q = supabase
    .from('agents')
    .select('id, full_name, region, active, skills')
    .order('full_name', { ascending: true });

  if (regionValue && regionValue !== 'ALL') {
    q = q.eq('region', regionValue);
  }

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countAgents() {
  const { count, error } = await supabase
    .from('agents')
    .select('*', { head: true, count: 'exact' });

  if (error) throw error;
  return count ?? 0;
}

