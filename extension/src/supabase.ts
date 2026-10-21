import { createClient } from '@supabase/supabase-js';

declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

/**
 * Storage adapter para guardar a sessão do supabase-js em chrome.storage.local
 */
const chromeStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      const res = await chrome.storage.local.get(key);
      const val = res && res[key];
      return typeof val === 'string' ? val : null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      console.error('Erro ao salvar no storage local:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await chrome.storage.local.remove(key);
    } catch (e) {
      console.error('Erro ao remover do storage local:', e);
    }
  },
};

export const supabase = createClient(__SUPABASE_URL__, __SUPABASE_ANON_KEY__, {
  auth: {
    storage: chromeStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});


