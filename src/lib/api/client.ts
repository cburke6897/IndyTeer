import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Database } from '../../types/database'

export const db = supabase as SupabaseClient<Database>
