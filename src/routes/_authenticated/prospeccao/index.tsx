import { useState, useEffect, useDeferredValue } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  listarProspects,
  concluirFollowup,
} from '@/lib/prospeccao.functions';
import { formatarData, statusData } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SeloPrado, SeloSituacaoMarca } from '@/components/prospeccao/selo-prado';
import { EtapaBadge, ETAPAS_LABELS } from '@/components/prospeccao/etapa-badge';
import { DialogEnviei } from '@/components/prospeccao/dialog-enviei';
import { DialogRespondeu } from '@/components/prospeccao/dialog-respondeu';
import { DialogRemarcar } from '@/components/prospeccao/dialog-remarcar';
import { DialogNovoProspect } from '@/components/prospeccao/dialog-novo-prospect';
import {
  Search,
  Plus,
  Send,
  MessageCircle,
  Calendar,
  Check,
  Building2,
  MapPin,
  Clock,
  Filter,
  X,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type EtapaComercial = Database['public']['Enums']['etapa_comercial'];
type SituacaoPrado = Database['public']['Enums']['situacao_prado'];

export const Route = createFileRoute('/_authenticated/prospeccao/')({
  head: () => ({
    meta: [
      { title: 'Prospecção | GAL Gestão' },
      { name: 'description', content: 'Gestão de construtoras, contatos e follow-ups comerciais.' },
    ],
  }),
  component: ProspeccaoPage,
});

function ProspeccaoPage() {
  const queryClient = useQueryClient();

  // Estados de busca e filtros
  const [busca, setBusca] = useState('');
  const buscaDiferida = useDeferredValue(busca);
  const [marcaFiltro, setMarcaFiltro] = useState<string>('todas');
  const [etapaFiltro, setEtapaFiltro] = useState<string>('todas');
  const [situacaoFiltro, setSituacaoFiltro] = useState<SituacaoPrado | 'todas'>('todas');
  const [apenasSemProximoPasso, setApenasSemProximoPasso] = useState(false);

  // Estados de modais
  const [modalNovoAberto, setModalNovoAberto] = useState(false);
  const [initialNovoValues, setInitialNovoValues] = useState<{
    nomeContato?: string;
    whatsapp?: string;
  } | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const novo = params.get('novo');
    if (novo === '1' || novo === 'true') {
      const wa = params.get('whatsapp') || '';
      const nome = params.get('nome') || '';
      setInitialNovoValues({
        whatsapp: wa,
        nomeContato: nome,
      });
      setModalNovoAberto(true);

      // Limpar os parâmetros da URL mantendo o histórico limpo
      const url = new URL(window.location.href);
      url.searchParams.delete('novo');
      url.searchParams.delete('whatsapp');
      url.searchParams.delete('nome');
      const novaUrl = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
      window.history.replaceState({}, '', novaUrl);
    }
  }, []);

  const [modalEnvieiAberto, setModalEnvieiAberto] = useState(false);
  const [modalRespondeuAberto, setModalRespondeuAberto] = useState(false);
  const [modalRemarcarAberto, setModalRemarcarAberto] = useState(false);

  const [prospectSelecionado, setProspectSelecionado] = useState<any | null>(null);

  // Server functions
  const fetchProspects = useServerFn(listarProspects);
  const executarConcluirFollowup = useServerFn(concluirFollowup);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      'prospects-lista',
      buscaDiferida,
      marcaFiltro,
      etapaFiltro,
      situacaoFiltro,
      apenasSemProximoPasso,
    ],
    queryFn: () =>
      fetchProspects({
        data: {
          texto: buscaDiferida.trim() || undefined,
          marcaId: marcaFiltro !== 'todas' ? marcaFiltro : undefined,
          etapa: etapaFiltro !== 'todas' ? etapaFiltro : undefined,
          situacao: situacaoFiltro !== 'todas' ? situacaoFiltro : undefined,
          apenasSemProximoPasso,
        },
      }),
  });

  const prospects = data?.prospects || [];
  const marcas = data?.marcas || [];
  const atalhosDias = data?.configuracoes?.atalhos_dias || [3, 7, 15, 30];

  function abrirEnviei(prospect: any) {
    setProspectSelecionado(prospect);
    setModalEnvieiAberto(true);
  }

  function abrirRespondeu(prospect: any) {
    setProspectSelecionado(prospect);
    setModalRespondeuAberto(true);
  }

  function abrirRemarcar(prospect: any) {
    setProspectSelecionado(prospect);
    setModalRemarcarAberto(true);
  }

  async function handleConcluirFollowup(followupId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await executarConcluirFollowup({ data: { id: followupId } });
      toast.success('Follow-up marcado como feito!');
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao concluir follow-up.');
    }
  }

  const temFiltrosAtivos =
    busca.trim() !== '' ||
    marcaFiltro !== 'todas' ||
    etapaFiltro !== 'todas' ||
    situacaoFiltro !== 'todas' ||
    apenasSemProximoPasso;

  function limparFiltros() {
    setBusca('');
    setMarcaFiltro('todas');
    setEtapaFiltro('todas');
    setSituacaoFiltro('todas');
    setApenasSemProximoPasso(false);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Topo: Título e Botão Novo Prospect */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Prospecção
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerenciamento de construtoras, oportunidades e próximos passos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-11 w-11 shrink-0"
            title="Atualizar listagem"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => setModalNovoAberto(true)}
            className="h-11 px-5 font-semibold gap-2 flex-1 sm:flex-none shadow-sm"
          >
            <Plus className="h-5 w-5" />
            + Novo prospect
          </Button>
        </div>
      </div>

      {/* 1. Busca no topo (chama buscar_clientes enquanto digita) */}
      <div className="relative mb-4">
        <Input
          placeholder="Buscar construtora (digite para buscar por similaridade)..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="h-13 pl-11 pr-10 text-base rounded-xl border-border bg-card shadow-xs focus:ring-2 focus:ring-primary"
        />
        <Search className="h-5 w-5 text-muted-foreground absolute left-3.5 top-4 pointer-events-none" />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca('')}
            className="absolute right-3.5 top-4 text-muted-foreground hover:text-foreground p-0.5"
            title="Limpar busca"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3. Filtros */}
      <div className="rounded-xl border border-border bg-card p-3 sm:p-4 mb-6 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            <span>Filtros</span>
          </div>
          {temFiltrosAtivos && (
            <button
              onClick={limparFiltros}
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Filtro Marca */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Marca
            </label>
            <select
              value={marcaFiltro}
              onChange={(e) => setMarcaFiltro(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
            >
              <option value="todas">Todas as marcas</option>
              {marcas.filter((m: any) => m.ativa !== false).map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.nome} {m.linha ? `(${m.linha})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Etapa */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Etapa comercial
            </label>
            <select
              value={etapaFiltro}
              onChange={(e) => setEtapaFiltro(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
            >
              <option value="todas">Todas as etapas</option>
              {Object.entries(ETAPAS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Situação do Cliente */}
          <div>
            <label className="text-[11px] font-medium text-muted-foreground block mb-1">
              Situação do cliente
            </label>
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value as SituacaoPrado | 'todas')}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary"
            >
              <option value="todas">Todas as situações</option>
              <option value="nao_verificado">Não verificado</option>
              <option value="livre">Livre</option>
              <option value="ja_cliente">Já é cliente</option>
              <option value="atendida_outro_rep">Atendido por outro rep.</option>
            </select>
          </div>

          {/* Toggle: Sem próximo passo */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setApenasSemProximoPasso(!apenasSemProximoPasso)}
              className={`w-full h-10 px-3 rounded-lg border text-xs font-medium flex items-center justify-center gap-2 transition-all ${
                apenasSemProximoPasso
                  ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold ring-1 ring-amber-500'
                  : 'border-input bg-background text-foreground hover:bg-accent'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Sem próximo passo
            </button>
          </div>
        </div>
      </div>

      {/* 2. Lista de construtoras */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="h-32 rounded-xl border border-border bg-card animate-pulse p-4"
            />
          ))}
        </div>
      ) : prospects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/60 p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground">Nenhuma construtora encontrada</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {temFiltrosAtivos
              ? 'Nenhum prospect atende aos filtros selecionados. Tente ajustar a busca.'
              : 'Cadastre sua primeira construtora clicando no botão "+ Novo prospect".'}
          </p>
          {temFiltrosAtivos ? (
            <Button variant="outline" onClick={limparFiltros} className="mt-4">
              Limpar filtros
            </Button>
          ) : (
            <Button onClick={() => setModalNovoAberto(true)} className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar prospect
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="text-xs font-semibold text-muted-foreground px-1">
            Exibindo {prospects.length} {prospects.length === 1 ? 'construtora' : 'construtoras'}
          </div>

          {prospects.map((p: any) => {
            const followup = p.followup_pendente;
            const statusFollowup = followup ? statusData(followup.data) : 'nenhum';

            return (
              <article
                key={p.id}
                className="group rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all"
              >
                {/* Cabeçalho do Card */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to="/prospeccao/$clienteId"
                        params={{ clienteId: p.id }}
                        className="text-lg font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        {p.nome}
                      </Link>

                      {/* Situação comercial por marca (PRADO primeiro, apenas marcas das oportunidades) */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {p.marcas && p.marcas.length > 0 ? (
                          p.marcas.map((m: any) => (
                            <SeloSituacaoMarca
                              key={m.id}
                              marcaNome={m.nome}
                              situacao={m.situacao}
                              representante={m.representante}
                            />
                          ))
                        ) : (
                          <SeloPrado
                            situacao={p.situacao_prado}
                            representante={p.representante_prado}
                          />
                        )}
                      </div>
                    </div>

                    {/* Aviso vermelho para marcas atendidas por outro representante */}
                    {p.marcas && p.marcas.length > 0 ? (
                      p.marcas
                        .filter((m: any) => m.situacao === 'atendida_outro_rep')
                        .map((m: any) => (
                          <div
                            key={m.id}
                            className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive flex items-center gap-1.5"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>
                              <strong>Atenção:</strong> {m.nome} é atendida por outro representante (
                              {m.representante || 'outro representante'}).
                            </span>
                          </div>
                        ))
                    ) : (
                      p.situacao_prado === 'atendida_outro_rep' && (
                        <div className="mt-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            <strong>Atenção:</strong> PRADO é atendida por outro representante (
                            {p.representante_prado || 'outro representante'}).
                          </span>
                        </div>
                      )
                    )}

                    {/* Cidade / UF e Contato */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {(p.cidade || p.uf) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {[p.cidade, p.uf].filter(Boolean).join(' / ')}
                        </span>
                      )}

                      {p.contato_principal && (
                        <span>
                          Contato: <strong>{p.contato_principal.nome}</strong>
                          {p.contato_principal.cargo && ` (${p.contato_principal.cargo})`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Marcas e Etapa */}
                  <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                    {p.marcas.map((m: any) => (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className="text-[11px] font-semibold px-2 py-0.5"
                      >
                        {m.nome}
                      </Badge>
                    ))}
                    <EtapaBadge etapa={p.etapa} />
                  </div>
                </div>

                {/* Follow-up pendente */}
                <div className="mt-3.5 pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    {followup ? (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Próximo passo: </span>
                        <strong className="text-foreground">{followup.motivo}</strong>
                        <span
                          className={`ml-2 inline-flex items-center rounded-sm px-1.5 py-0.5 font-bold ${
                            statusFollowup === 'atrasado'
                              ? 'bg-destructive/15 text-destructive'
                              : statusFollowup === 'hoje'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {formatarData(followup.data)}
                          {statusFollowup === 'atrasado' && ' (atrasado)'}
                          {statusFollowup === 'hoje' && ' (hoje)'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        Sem próximo passo agendado
                      </span>
                    )}
                  </div>

                  {/* Botões de Ação Rápida */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Botão Enviei */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEnviei(p)}
                      className="h-9 px-3 text-xs font-semibold gap-1.5"
                    >
                      <Send className="h-3.5 w-3.5 text-primary" />
                      Enviei
                    </Button>

                    {/* Botão Respondeu */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirRespondeu(p)}
                      className="h-9 px-3 text-xs font-semibold gap-1.5"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      Respondeu
                    </Button>

                    {/* Botões do Follow-up pendente */}
                    {followup && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrirRemarcar(p)}
                          className="h-9 px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          title="Remarcar data do follow-up"
                        >
                          Remarcar
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => handleConcluirFollowup(followup.id, e)}
                          className="h-9 px-3 text-xs font-semibold gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                          title="Marcar follow-up como concluído"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Feito
                        </Button>
                      </>
                    )}

                    <Button
                      asChild
                      size="sm"
                      variant="ghost"
                      className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Link to="/prospeccao/$clienteId" params={{ clienteId: p.id }}>
                        Ficha →
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Modais de Ação */}
      <DialogNovoProspect
        open={modalNovoAberto}
        onOpenChange={setModalNovoAberto}
        marcasDisponiveis={marcas}
        initialValues={initialNovoValues}
        onSuccess={() => refetch()}
      />

      {prospectSelecionado && (
        <>
          <DialogEnviei
            open={modalEnvieiAberto}
            onOpenChange={setModalEnvieiAberto}
            contatoId={prospectSelecionado.contato_principal?.id}
            contatoNome={prospectSelecionado.contato_principal?.nome}
            clienteNome={prospectSelecionado.nome}
            oportunidades={prospectSelecionado.oportunidades}
            atalhosDias={atalhosDias}
            onSuccess={() => refetch()}
          />

          <DialogRespondeu
            open={modalRespondeuAberto}
            onOpenChange={setModalRespondeuAberto}
            contatoId={prospectSelecionado.contato_principal?.id}
            contatoNome={prospectSelecionado.contato_principal?.nome}
            clienteNome={prospectSelecionado.nome}
            oportunidades={prospectSelecionado.oportunidades}
            onSuccess={() => refetch()}
          />

          <DialogRemarcar
            open={modalRemarcarAberto}
            onOpenChange={setModalRemarcarAberto}
            followupId={prospectSelecionado.followup_pendente?.id}
            motivo={prospectSelecionado.followup_pendente?.motivo}
            dataAtual={prospectSelecionado.followup_pendente?.data}
            atalhosDias={atalhosDias}
            onSuccess={() => refetch()}
          />
        </>
      )}
    </main>
  );
}
