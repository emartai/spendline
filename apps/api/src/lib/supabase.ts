import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required')
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is required')
}

if (!supabaseServiceKey) {
  throw new Error('SUPABASE_SERVICE_KEY is required')
}

export const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseService = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

