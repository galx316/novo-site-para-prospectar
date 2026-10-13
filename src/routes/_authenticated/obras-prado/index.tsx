import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { listarObras } from '@/lib/obras.functions';
import { formatarData } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  Filter,
  Users,
} from 'lucide-react';

type FiltroStatus = 'em_andamento' | 'finalizadas' | 'todas';

export const Route = createFileRoute('/_authenticated/obras-prado/')({
  head: () => ({
    meta: [
      { title: 'Obras Prado | GAL Gestão' },
      { name: 'description', content: 'Gestão operacional de obras PRADO, lotes e entregas.' },
    ],
  }),
  component: ObrasPradoListPage,
});

function ObrasPradoListPage() {
  const [filtro, setFiltro] = useState<FiltroStatus>('em_andamento');

  const fetchObras = useServerFn(listarObras);

  const { data: obras = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['obras-prado-lista'],
    queryFn: () => fetchObras(),
  });

  const obrasFiltradas = obras.filter((obra: any) => {
    if (filtro === 'em_andamento') return !obra.finalizada_em;
    if (filtro === 'finalizadas') return !!obra.finalizada_em;
    return true;
  });

  const totalEmAndamento = obras.filter((o: any) => !o.finalizada_em).length;
  const totalFinalizadas = obras.filter((o: any) => !!o.finalizada_em).length;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Operacional</p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Obras Prado
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhamento operacional de pedidos, medições, lotes e cronogramas.
          </p>
        </div>

        {/* Filtros de status */}
        <div className="flex items-center rounded-lg border border-border bg-card p-1 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFiltro('em_andamento')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtro === 'em_andamento'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Em andamento ({totalEmAndamento})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('finalizadas')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtro === 'finalizadas'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Finalizadas ({totalFinalizadas})
          </button>
          <button
            type="button"
            onClick={() => setFiltro('todas')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtro === 'todas'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todas ({obras.length})
          </button>
        </div>
      </div>

      {/* Conteúdo principal */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-44 rounded-xl border border-border bg-card/50 animate-pulse p-5 space-y-3"
            >
              <div className="h-5 w-3/4 bg-muted rounded" />
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-8 bg-muted rounded mt-4" />
            </div>
          ))}
        </div>
      ) : obrasFiltradas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12 shadow-2xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Building2 className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-foreground">
            {filtro === 'em_andamento' && 'Nenhuma obra em andamento'}
            {filtro === 'finalizadas' && 'Nenhuma obra finalizada'}
            {filtro === 'todas' && 'Nenhuma obra encontrada'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            Para iniciar uma nova obra, abra uma oportunidade PRADO na Prospecção e clique em{' '}
            <strong className="text-foreground">Iniciar gestão da obra</strong>.
          </p>
          <div className="mt-6 flex justify-center">
            <Button asChild variant="outline" className="gap-2 font-medium">
              <Link to="/prospeccao">
                <Users className="h-4 w-4" />
                Ir para Prospecção
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {obrasFiltradas.map((obra: any) => {
            const isFinalizada = !!obra.finalizada_em;
            const temProblema = !!obra.problema_ativo;
            const percentualEntregue =
              obra.totalLotes > 0 ? Math.round((obra.lotesEntregues / obra.totalLotes) * 100) : 0;

            return (
              <Link
                key={obra.id}
                to="/obras-prado/$obraId"
                params={{ obraId: obra.id }}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-2xs transition-all hover:border-primary/50 hover:shadow-md hover:-translate-y-0.5"
              >
                <div className="space-y-3">
                  {/* Topo do card: Badges e Alertas */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-base text-foreground truncate group-hover:text-primary transition-colors">
                        {obra.nome}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                        {obra.clienteNome}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      {temProblema && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 flex items-center gap-1 shadow-2xs"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          Problema
                        </Badge>
                      )}
                      {isFinalizada && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-muted text-muted-foreground"
                        >
                          Finalizada
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Informações adicionais */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pt-1">
                    {obra.cidade && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {obra.cidade}
                      </span>
                    )}
                    {obra.data_fechamento && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Fechamento: {formatarData(obra.data_fechamento)}
                      </span>
                    )}
                  </div>

                  {/* Status de Lotes e Entrega */}
                  <div className="rounded-lg bg-accent/40 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        Lotes Entregues
                      </span>
                      <span className="font-bold text-foreground">
                        {obra.lotesEntregues} / {obra.totalLotes}
                      </span>
                    </div>

                    {/* Barra de progresso visual */}
                    <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          percentualEntregue === 100 ? 'bg-emerald-500' : 'bg-primary'
                        }`}
                        style={{ width: `${percentualEntregue}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-0.5">
                      <span className="text-muted-foreground">Próxima entrega:</span>
                      <span
                        className={`font-semibold ${
                          obra.proximaEntrega ? 'text-foreground' : 'text-muted-foreground italic'
                        }`}
                      >
                        {obra.proximaEntrega ? formatarData(obra.proximaEntrega) : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Rodapé do card */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-primary font-semibold mt-2">
                  <span>Acessar ficha da obra</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
