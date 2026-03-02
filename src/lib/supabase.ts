import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://knrxjexvuaefqfowvkhy.supabase.co';
const supabaseKey = 'sb_publishable_aCLHxoz3nfF9CFdqGF-ddA_prPmMeIM';

export const supabase = createClient(supabaseUrl, supabaseKey);
