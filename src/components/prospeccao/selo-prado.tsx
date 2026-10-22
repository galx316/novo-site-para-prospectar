import { AlertCircle, HelpCircle, CheckCircle2, UserCheck } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type SituacaoPrado = Database['public']['Enums']['situacao_prado'];

interface SeloPradoProps {
  situacao?: SituacaoPrado | null | undefined;
  representante?: string | null | undefined;
  className?: string | undefined;
}

export function SeloPrado({ situacao, representante, className = '' }: SeloPradoProps) {
  if (situacao === 'ja_cliente') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/25 shadow-xs ${className}`}
      >
        <UserCheck className="h-3.5 w-3.5 shrink-0" />
        Já é cliente
      </span>
    );
  }

  if (situacao === 'atendida_outro_rep') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive border border-destructive/25 shadow-xs ${className}`}
        title={`Atendida pelo representante ${representante || 'outro'}`}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        PRADO: atendida por {representante || 'outro rep.'}
      </span>
    );
  }

  if (situacao === 'nao_verificado' || !situacao) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-xs ${className}`}
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
        PRADO: não verificado
      </span>
    );
  }

  if (situacao === 'livre') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        PRADO: livre
      </span>
    );
  }

  return null;
}

export function SeloSituacaoMarca({
  marcaNome,
  situacao,
  representante,
  className = '',
}: {
  marcaNome: string;
  situacao?: SituacaoPrado | null | undefined;
  representante?: string | null | undefined;
  className?: string | undefined;
}) {
  const nomeExibicao = marcaNome?.trim() || 'Marca';

  if (situacao === 'ja_cliente') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-500/25 shadow-xs ${className}`}
      >
        <UserCheck className="h-3.5 w-3.5 shrink-0" />
        {nomeExibicao}: Já é cliente
      </span>
    );
  }

  if (situacao === 'atendida_outro_rep') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-destructive/15 px-2.5 py-1 text-xs font-semibold text-destructive border border-destructive/25 shadow-xs ${className}`}
        title={`${nomeExibicao}: atendida pelo representante ${representante || 'outro'}`}
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        {nomeExibicao}: atendida por {representante || 'outro rep.'}
      </span>
    );
  }

  if (situacao === 'livre') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 ${className}`}
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        {nomeExibicao}: livre
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 border border-amber-500/25 shadow-xs ${className}`}
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      {nomeExibicao}: não verificado
    </span>
  );
}
