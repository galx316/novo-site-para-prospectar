import type { Database } from '@/integrations/supabase/types';

type EtapaComercial = Database['public']['Enums']['etapa_comercial'];

export const ETAPAS_LABELS: Record<EtapaComercial, string> = {
  prospeccao: 'Prospecção',
  aguardando_demanda: 'Aguardando demanda',
  demanda_prevista: 'Demanda prevista',
  orcamento: 'Orçamento',
  negociacao: 'Negociação',
  fechado: 'Fechado',
  perdido: 'Perdido',
};

const ETAPAS_STYLES: Record<EtapaComercial, string> = {
  prospeccao: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
  aguardando_demanda: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
  demanda_prevista: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  orcamento: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  negociacao: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  fechado: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  perdido: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20',
};

export function EtapaBadge({ etapa, className = '' }: { etapa?: EtapaComercial | null; className?: string }) {
  if (!etapa) return null;
  const label = ETAPAS_LABELS[etapa] || etapa;
  const style = ETAPAS_STYLES[etapa] || 'bg-muted text-muted-foreground border-border';

  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${style} ${className}`}
    >
      {label}
    </span>
  );
}
