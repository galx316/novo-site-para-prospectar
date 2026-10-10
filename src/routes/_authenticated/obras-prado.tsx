import { createFileRoute, Link } from '@tanstack/react-router';
import { Building, Users, Construction } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/obras-prado')({
  head: () => ({
    meta: [
      { title: 'Obras Prado | GAL Gestão' },
      { name: 'description', content: 'Acompanhamento e gestão de obras PRADO no GAL Gestão.' },
    ],
  }),
  component: ObrasPradoPage,
});

function ObrasPradoPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Gestão de Obras</p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground mt-1">Obras Prado</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhamento operacional de lotes, medições e cronogramas.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center sm:p-12 shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Construction className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página em construção</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          O módulo de gestão de obras PRADO será ativado nas próximas etapas. Acesse a prospecção comercial para acompanhar o funil de vendas e contatos.
        </p>
        <div className="mt-6 flex justify-center">
          <Button asChild className="gap-2 h-11 px-6 font-medium">
            <Link to="/prospeccao">
              <Users className="h-4 w-4" />
              Acessar Prospecção
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
