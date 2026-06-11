// Re-exportamos el cliente único centralizado para que nada viejo se rompa
import { supabase } from '../../lib/supabaseClient';
export { supabase };

// Si tenías una función que se llamaba createClientSupabaseClient, la dejamos mapeada al único:
export const createClientSupabaseClient = () => supabase;