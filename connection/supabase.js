// const { createClient } = require('@supabase/supabase-js');

// const supabaseUrl = process.env.VITE_SUPABASE_URL;
// const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// if (!supabaseUrl || !supabaseKey) {
//   throw new Error('Missing Supabase environment variables. Please check your .env file.');
// }

// const supabase = createClient(supabaseUrl, supabaseKey);

// module.exports = supabase;

const { createClient } = require('@supabase/supabase-js');

let _supabase = null;

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  }
  return _supabase;
};

module.exports = getSupabase;