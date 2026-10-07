import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AlertTriangle, Clock3, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getAlertCounts } from '@/lib/alertas.functions';
import { Button } from '@/components/ui/button';
import { GalBrand } from '@/components/gal-brand';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Alertas | GAL Gestão' },
    { name: 'description', content: 'Contagem de alertas críticos e pendentes do GAL Gestão.' },
    { property: 'og:title', content: 'Alertas | GAL Gestão' },
    { property: 'og:description', content: 'Contagem de alertas críticos e pendentes do GAL Gestão.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signedIn, setSignedIn] = useState(false);
  const fetchCounts = useServerFn(getAlertCounts);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) navigate({ to: '/auth', replace: true });
      else setSignedIn(true);
    });
    return () => { active = false; };
  }, [navigate]);
  const counts = useQuery({ queryKey: ['gal-alert-counts'], queryFn: () => fetchCounts(), enabled: signedIn, retry: false });
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return;
    queryClient.clear();
    await navigate({ to: '/auth', replace: true });
  }
  if (!signedIn) return <main className="flex min-h-svh items-center justify-center bg-background"><Loader2 aria-label="Verificando acesso" className="animate-spin text-primary" /></main>;
  return <main className="min-h-svh bg-background">
    <header className="flex items-center justify-between border-b border-border px-6 py-6 sm:px-12"><GalBrand /><Button variant="ghost" onClick={signOut}><LogOut /> Sair</Button></header>
    <section className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
      <div className="mb-10 flex items-end justify-between gap-4"><div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Visão geral</p><h1 className="text-3xl font-semibold">Alertas</h1><p className="mt-3 text-sm text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date())}</p></div><Button variant="outline" size="icon" title="Atualizar alertas" aria-label="Atualizar alertas" disabled={counts.isFetching} onClick={() => counts.refetch()}><RefreshCw className={counts.isFetching ? 'animate-spin' : ''} /></Button></div>
      {counts.isError ? <div role="alert" className="border-l-2 border-destructive py-3 pl-4"><p className="text-sm text-destructive">{counts.error.message}</p><Button variant="link" className="mt-2 px-0" onClick={() => counts.refetch()}>Tentar novamente</Button></div> : <div className="grid gap-6 sm:grid-cols-2">
        <article className="rounded-lg border border-border bg-card p-7"><div className="flex items-center justify-between"><h2 className="font-medium">Críticos</h2><AlertTriangle className="text-destructive" size={21} /></div><p className="mt-9 min-h-16 text-5xl font-semibold tabular-nums">{counts.isPending ? '—' : counts.data.critico}</p><p className="mt-3 text-sm text-muted-foreground">Nível crítico</p></article>
        <article className="rounded-lg border border-border bg-card p-7"><div className="flex items-center justify-between"><h2 className="font-medium">Pendentes</h2><Clock3 className="text-primary" size={21} /></div><p className="mt-9 min-h-16 text-5xl font-semibold tabular-nums">{counts.isPending ? '—' : counts.data.pendente}</p><p className="mt-3 text-sm text-muted-foreground">Nível pendente</p></article>
      </div>}
    </section>
  </main>;
}
