import { createClient } from '@supabase/supabase-js';

// Projeto consolidado: nucly-agency (dasbpktslyovikphwmrt).
// Os dados do dashboard vivem no schema `napan`, isolados do schema public do Nucly.
const supabaseUrl = 'https://dasbpktslyovikphwmrt.supabase.co';
const supabaseKey = 'sb_publishable_Y2J3_HkrtokpW8wI4GfB5Q__CsnAAWd';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'napan' },
});
