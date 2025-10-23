// assets/js/supabase.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ❗ Mets tes vraies valeurs ici (Supabase Studio > Project Settings > API)
export const SUPABASE_URL = 'https://zllfthitcgexvvumxxpu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsbGZ0aGl0Y2dleHZ2dW14eHB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4OTkyMzQsImV4cCI6MjA3NjQ3NTIzNH0.oXi1IhdQev1Xjy75UsZ_Kejocp3ZgdKclMqsVLSNeG4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
