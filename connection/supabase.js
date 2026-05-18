const { createClient } = require('@supabase/supabase-js');

let _supabase = null;

const getSupabase = () => {
  if (!_supabase) {
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'OK' : 'MISSING');
    console.log('SUPABASE_SERVICE_ROLE:', process.env.SUPABASE_SERVICE_ROLE ? 'OK' : 'MISSING');
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE
    );
  }
  return _supabase;
};

module.exports = getSupabase;