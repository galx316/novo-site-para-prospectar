import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export const getAlertCounts = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: authorized, error: authorizationError } = await context.supabase.rpc('is_authorized');
    if (authorizationError) throw new Error(authorizationError.message);
    if (!authorized) throw new Error('Seu e-mail não está autorizado.');
    const [critical, pending] = await Promise.all([
      context.supabase.from('v_alertas').select('*', { count: 'exact', head: true }).eq('nivel', 'critico'),
      context.supabase.from('v_alertas').select('*', { count: 'exact', head: true }).eq('nivel', 'pendente'),
    ]);
    if (critical.error) throw new Error(critical.error.message);
    if (pending.error) throw new Error(pending.error.message);
    return { critico: critical.count ?? 0, pendente: pending.count ?? 0 };
  });