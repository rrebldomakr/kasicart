import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ctnmiwmiymzhsafwxnxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_E9cG98_wCYNPlKom7NcJ9w__5OD1vGw';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);