import { createClient } from '@supabase/supabase-js';

// Retrieve environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables');
}

// Initialize Supabase client with real-time disabled
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
  realtime: {
    enabled: false // Explicitly disable real-time to prevent WebSocket connections
  }
});

// Retry logic for Supabase operations
const withRetry = async (fn, options = {}) => {
  const { maxRetries = 3, delayMs = 1000, timeoutMs = 20000 } = options;

  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
      });
      return await Promise.race([fn(), timeoutPromise]);
    } catch (err) {
      lastError = err;
      if (i === maxRetries - 1) break;
      console.warn(`Retry ${i + 1}/${maxRetries} after error: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1))); // Exponential backoff
    }
  }
  throw lastError;
};

// Test Supabase connection
const testSupabaseConnection = async () => {
  try {
    console.log('Supabase: Testing connection...');
    const { data, error } = await withRetry(() => supabase.from('users').select('id').limit(1));
    if (error) {
      console.error('Supabase: Connection test failed:', error.message);
      throw error;
    }
    console.log('Supabase: Connection test successful, sample data:', data);
  } catch (err) {
    console.error('Supabase: Unexpected error during connection test:', err.message);
    throw err;
  }
};

// Run the connection test
testSupabaseConnection().catch((err) => {
  console.error('Supabase: Failed to initialize connection:', err.message);
});

export { supabase, withRetry };
