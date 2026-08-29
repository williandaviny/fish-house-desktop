import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Erro: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não estão definidos. ' +
    'Verifique as variáveis de ambiente de build no seu servidor de hospedagem.'
  );
}

// Cria um cliente com Proxy para evitar travamento do carregamento do bundle JS
export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey)
  : new Proxy({} as any, {
      get(_, prop) {
        console.error(
          `[Supabase] Erro de Inicialização: Tentativa de acessar a propriedade "${String(prop)}" ` +
          'no cliente Supabase, mas ele não foi configurado devidamente.'
        );
        return () => {
          throw new Error(
            'O cliente Supabase não está configurado. Verifique se as variáveis de ambiente ' +
            'VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY foram passadas durante a compilação (build).'
          );
        };
      }
    });

