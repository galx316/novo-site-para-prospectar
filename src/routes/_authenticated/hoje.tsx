import { createFileRoute, Link } from '@tanstack/react-router';
import { Calendar, Users, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/hoje')({
  head: () => ({
    meta: [
      { title: 'Hoje | GAL Gestão' },
      { name: 'description', content: 'Painel diário de atividades e tarefas do GAL Gestão.' },
    ],
  }),
  component: HojePage,
});

function HojePage() {
  const dataHojeExtenso = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Painel Diário</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">Hoje</h1>
        <p className="text-sm text-muted-foreground capitalize mt-1">{dataHojeExtenso}</p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12 shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página em construção</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          O painel diário consolidado está sendo preparado nesta fase do projeto. Utilize a área de Prospecção para gerenciar construtoras, contatos e follow-ups.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild className="gap-2 h-11 px-5 font-medium">
            <Link to="/prospeccao">
              <Users className="h-4 w-4" />
              Ir para Prospecção
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-11 px-5">
            <Link to="/inicio">
              Ver Alertas do Sistema
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
