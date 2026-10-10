import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  obterFichaCliente,
  atualizarCliente,
  adicionarContato,
  concluirFollowup,
} from '@/lib/prospeccao.functions';
import { formatarData, formatarDataHora, formatarMesAno, statusData } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SeloPrado } from '@/components/prospeccao/selo-prado';
import { EtapaBadge } from '@/components/prospeccao/etapa-badge';
import { DialogEnviei } from '@/components/prospeccao/dialog-enviei';
import { DialogRespondeu } from '@/components/prospeccao/dialog-respondeu';
import { DialogRemarcar } from '@/components/prospeccao/dialog-remarcar';
import { DialogMesclarCliente } from '@/components/prospeccao/dialog-mesclar-cliente';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Calendar,
  Send,
  MessageCircle,
  Phone,
  Mail,
  Edit2,
  Check,
  X,
  Plus,
  Merge,
  Clock,
  History,
  Briefcase,
  User,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type SituacaoPrado = Database['public']['Enums']['situacao_prado'];

export const Route = createFileRoute('/_authenticated/prospeccao/$clienteId')({
  head: () => ({
    meta: [
      { title: 'Ficha da Construtora | GAL Gestão' },
      { name: 'description', content: 'Ficha cadastral, contatos, oportunidades e histórico da construtora.' },
    ],
  }),
  component: FichaClientePage,
});

function FichaClientePage() {
  const { clienteId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados de edição de dados da construtora
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState('');
  const [cidadeEdit, setCidadeEdit] = useState('');
  const [ufEdit, setUfEdit] = useState('');
  const [cnpjEdit, setCnpjEdit] = useState('');
  const [situacaoPradoEdit, setSituacaoPradoEdit] = useState<SituacaoPrado>('nao_verificado');
  const [repPradoEdit, setRepPradoEdit] = useState('');
  const [obsEdit, setObsEdit] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Estados para novo contato
  const [modalNovoContato, setModalNovoContato] = useState(false);
  const [nomeNovoContato, setNomeNovoContato] = useState('');
  const [cargoNovoContato, setCargoNovoContato] = useState('');
  const [waNovoContato, setWaNovoContato] = useState('');
  const [emailNovoContato, setEmailNovoContato] = useState('');
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Estados de modais de ações
  const [modalEnviei, setModalEnviei] = useState(false);
  const [modalRespondeu, setModalRespondeu] = useState(false);
  const [modalRemarcar, setModalRemarcar] = useState(false);
  const [modalMesclar, setModalMesclar] = useState(false);
  const [contatoSelecionado, setContatoSelecionado] = useState<any | null>(null);

  // Server functions
  const fetchFicha = useServerFn(obterFichaCliente);
  const salvarCliente = useServerFn(atualizarCliente);
  const criarContato = useServerFn(adicionarContato);
  const executarConcluirFollowup = useServerFn(concluirFollowup);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ficha-cliente', clienteId],
    queryFn: () => fetchFicha({ data: { clienteId } }),
  });

  const cliente = data?.cliente;
  const contatos = data?.contatos || [];
  const oportunidades = data?.oportunidades || [];
  const followupDestaque = data?.followup_destaque;
  const registros = data?.registros || [];
  const atalhosDias = data?.configuracoes?.atalhos_dias || [3, 7, 15, 30];

  function iniciarEdicao() {
    if (!cliente) return;
    setNomeEdit(cliente.nome || '');
    setCidadeEdit(cliente.cidade || '');
    setUfEdit(cliente.uf || '');
    setCnpjEdit(cliente.cnpj || '');
    setSituacaoPradoEdit(cliente.situacao_prado || 'nao_verificado');
    setRepPradoEdit(cliente.representante_prado || '');
    setObsEdit(cliente.observacoes || '');
    setEditando(true);
  }

  async function handleSalvarEdicao(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeEdit.trim()) {
      toast.error('Informe o nome da construtora.');
      return;
    }

    setSalvandoEdicao(true);
    try {
      await salvarCliente({
        data: {
          id: clienteId,
          nome: nomeEdit.trim(),
          cidade: cidadeEdit.trim() || undefined,
          uf: ufEdit.trim() || undefined,
          cnpj: cnpjEdit.trim() || undefined,
          observacoes: obsEdit.trim() || undefined,
          situacaoPrado: situacaoPradoEdit,
          representantePrado:
            situacaoPradoEdit === 'atendida_outro_rep' ? repPradoEdit.trim() : undefined,
        },
      });

      toast.success('Dados da construtora atualizados com sucesso!');
      setEditando(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar dados.');
    } finally {
      setSalvandoEdicao(false);
    }
  }

  async function handleAdicionarContato(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeNovoContato.trim()) {
      toast.error('Informe o nome do contato.');
      return;
    }

    setSalvandoContato(true);
    try {
      await criarContato({
        data: {
          clienteId,
          nome: nomeNovoContato.trim(),
          cargo: cargoNovoContato.trim() || undefined,
          whatsapp: waNovoContato.trim() || undefined,
          email: emailNovoContato.trim() || undefined,
        },
      });

      toast.success('Novo contato adicionado com sucesso!');
      setModalNovoContato(false);
      setNomeNovoContato('');
      setCargoNovoContato('');
      setWaNovoContato('');
      setEmailNovoContato('');
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar contato.');
    } finally {
      setSalvandoContato(false);
    }
  }

  async function handleConcluirFollowup(id: string) {
    try {
      await executarConcluirFollowup({ data: { id } });
      toast.success('Follow-up marcado como concluído!');
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao concluir follow-up.');
    }
  }

  function abrirEnviei(contato?: any) {
    setContatoSelecionado(contato || contatos[0] || null);
    setModalEnviei(true);
  }

  function abrirRespondeu(contato?: any) {
    setContatoSelecionado(contato || contatos[0] || null);
    setModalRespondeu(true);
  }

  if (isLoading) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8 animate-pulse space-y-4">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="h-44 bg-card rounded-xl border border-border" />
        <div className="h-64 bg-card rounded-xl border border-border" />
      </main>
    );
  }

  if (!cliente) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-center">
        <h2 className="text-xl font-bold">Construtora não encontrada</h2>
        <Button asChild className="mt-4">
          <Link to="/prospeccao">Voltar para Prospecção</Link>
        </Button>
      </main>
    );
  }

  const statusFollowup = followupDestaque ? statusData(followupDestaque.data) : 'nenhum';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Botão Voltar e Ações do Topo */}
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Link to="/prospeccao">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Prospecção
          </Link>
        </Button>

        {/* Botão Juntar com... */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setModalMesclar(true)}
          className="gap-1.5 font-semibold text-xs h-9"
          title="Mesclar construtora duplicada nesta ficha"
        >
          <Merge className="h-3.5 w-3.5 text-primary" />
          Juntar com...
        </Button>
      </div>

      {/* 1. Dados da Construtora com Edição */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xs">
        {editando ? (
          <form onSubmit={handleSalvarEdicao} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground">Editar Dados da Construtora</h2>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditando(false)}
                  disabled={salvandoEdicao}
                >
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button type="submit" size="sm" disabled={salvandoEdicao}>
                  <Check className="h-4 w-4 mr-1" />
                  {salvandoEdicao ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nome da Construtora *
                </label>
                <Input
                  value={nomeEdit}
                  onChange={(e) => setNomeEdit(e.target.value)}
                  className="h-10 bg-background"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  CNPJ (opcional)
                </label>
                <Input
                  value={cnpjEdit}
                  onChange={(e) => setCnpjEdit(e.target.value)}
                  placeholder="Apenas números ou formatado"
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Cidade
                </label>
                <Input
                  value={cidadeEdit}
                  onChange={(e) => setCidadeEdit(e.target.value)}
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  UF (Estado)
                </label>
                <Input
                  value={ufEdit}
                  onChange={(e) => setUfEdit(e.target.value.toUpperCase())}
                  maxLength={2}
                  className="h-10 bg-background"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Situação PRADO
                </label>
                <select
                  value={situacaoPradoEdit}
                  onChange={(e) => setSituacaoPradoEdit(e.target.value as SituacaoPrado)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm font-medium"
                >
                  <option value="nao_verificado">Não verificado</option>
                  <option value="livre">Livre</option>
                  <option value="atendida_outro_rep">Atendida por outro representante</option>
                </select>
              </div>

              {situacaoPradoEdit === 'atendida_outro_rep' && (
                <div>
                  <label className="text-xs font-semibold text-destructive block mb-1">
                    Nome do Representante PRADO
                  </label>
                  <Input
                    value={repPradoEdit}
                    onChange={(e) => setRepPradoEdit(e.target.value)}
                    placeholder="Ex: Carlos Silva"
                    className="h-10 bg-background"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Observações internas
              </label>
              <Textarea
                value={obsEdit}
                onChange={(e) => setObsEdit(e.target.value)}
                rows={2}
                className="bg-background"
              />
            </div>
          </form>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {cliente.nome}
                  </h1>
                  <SeloPrado
                    situacao={cliente.situacao_prado}
                    representante={cliente.representante_prado}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                  {(cliente.cidade || cliente.uf) && (
                    <span className="flex items-center gap-1 font-medium">
                      <MapPin className="h-3.5 w-3.5" />
                      {[cliente.cidade, cliente.uf].filter(Boolean).join(' / ')}
                    </span>
                  )}
                  {cliente.cnpj && (
                    <span>
                      CNPJ: <strong>{cliente.cnpj}</strong>
                    </span>
                  )}
                  <span>
                    Cadastrado em:{' '}
                    <strong>{formatarData(cliente.created_at)}</strong>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={iniciarEdicao}
                  className="gap-1.5 h-9 text-xs font-medium"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Editar Dados
                </Button>
              </div>
            </div>

            {cliente.observacoes && (
              <p className="mt-3 text-xs text-muted-foreground bg-accent/40 rounded-lg p-2.5">
                {cliente.observacoes}
              </p>
            )}
          </div>
        )}
      </section>

      {/* 2. Follow-up Pendente em Destaque */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Follow-up em Destaque
            </h2>
          </div>
          {followupDestaque && (
            <span
              className={`rounded-md px-2.5 py-0.5 text-xs font-bold ${
                statusFollowup === 'atrasado'
                  ? 'bg-destructive/15 text-destructive'
                  : statusFollowup === 'hoje'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-primary/10 text-primary'
              }`}
            >
              Data: {formatarData(followupDestaque.data)}
              {statusFollowup === 'atrasado' && ' (atrasado)'}
              {statusFollowup === 'hoje' && ' (hoje)'}
            </span>
          )}
        </div>

        {followupDestaque ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-accent/40 p-4">
              <p className="text-sm font-semibold text-foreground">
                Motivo: {followupDestaque.motivo}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Origem: {followupDestaque.origem} • Agendado para{' '}
                {formatarData(followupDestaque.data)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => abrirEnviei()}
                className="h-10 px-4 font-semibold gap-1.5"
              >
                <Send className="h-3.5 w-3.5" />
                Enviei
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => abrirRespondeu()}
                className="h-10 px-4 font-semibold gap-1.5"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Respondeu
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setModalRemarcar(true)}
                className="h-10 px-3 text-xs font-semibold"
              >
                Remarcar
              </Button>

              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleConcluirFollowup(followupDestaque.id)}
                className="h-10 px-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Marcar como Feito
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground italic">
              Nenhum follow-up pendente para esta construtora.
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <Button size="sm" variant="outline" onClick={() => abrirEnviei()} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Registrar Envio
              </Button>
              <Button size="sm" variant="outline" onClick={() => abrirRespondeu()} className="gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Registrar Resposta
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Grid: Contatos e Oportunidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 3. Contatos */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Contatos ({contatos.length})
              </h2>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setModalNovoContato(true)}
              className="h-8 text-xs gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo contato
            </Button>
          </div>

          {contatos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              Nenhum contato cadastrado.
            </p>
          ) : (
            <div className="space-y-3">
              {contatos.map((contato: any) => {
                const numeroWaLimpo = (contato.whatsapp || '').replace(/\D/g, '');
                return (
                  <div
                    key={contato.id}
                    className="rounded-lg border border-border p-3.5 space-y-2.5 bg-background"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-foreground">{contato.nome}</p>
                        {contato.cargo && (
                          <p className="text-xs text-muted-foreground">{contato.cargo}</p>
                        )}
                      </div>
                      {contato.tentativas_sem_resposta > 0 && (
                        <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                          {contato.tentativas_sem_resposta}ª tentativa
                        </span>
                      )}
                    </div>

                    {/* Botões de Ação Direta: WhatsApp, Ligar, E-mail */}
                    <div className="flex flex-wrap gap-2 pt-1 border-t border-border/60">
                      {numeroWaLimpo ? (
                        <>
                          <a
                            href={`https://wa.me/${numeroWaLimpo}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                          <a
                            href={`tel:${numeroWaLimpo}`}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 text-xs font-semibold transition-colors"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            Ligar
                          </a>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Sem telefone</span>
                      )}

                      {contato.email && (
                        <a
                          href={`mailto:${contato.email}`}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-400 text-xs font-semibold transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          E-mail
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 4. Oportunidades */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Oportunidades ({oportunidades.length})
              </h2>
            </div>
          </div>

          {oportunidades.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3 text-center">
              Nenhuma oportunidade cadastrada.
            </p>
          ) : (
            <div className="space-y-3">
              {oportunidades.map((op: any) => (
                <div
                  key={op.id}
                  className="rounded-lg border border-border p-3.5 space-y-2 bg-background"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1">
                      {op.marcas.map((m: any) => (
                        <Badge key={m.id} variant="secondary" className="text-xs font-semibold">
                          {m.nome}
                        </Badge>
                      ))}
                    </div>
                    <EtapaBadge etapa={op.etapa} />
                  </div>

                  {op.necessidade_prevista && (
                    <p className="text-xs text-muted-foreground">
                      Necessidade prevista:{' '}
                      <strong className="text-foreground">
                        {formatarMesAno(op.necessidade_prevista)}
                      </strong>
                    </p>
                  )}

                  {op.descricao && (
                    <p className="text-xs text-foreground bg-accent/30 p-2 rounded">
                      {op.descricao}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 5. Histórico (registros) */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
              Histórico de Interações ({registros.length})
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">Do mais recente ao mais antigo</span>
        </div>

        {registros.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-6 text-center">
            Nenhum registro de interação até o momento.
          </p>
        ) : (
          <div className="space-y-2.5">
            {registros.map((reg: any) => {
              const ehEnviado = reg.direcao === 'enviado';
              const ehRecebido = reg.direcao === 'recebido';

              return (
                <div
                  key={reg.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-background/80"
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                      ehEnviado
                        ? 'bg-primary/10 text-primary'
                        : ehRecebido
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {ehEnviado ? (
                      <Send className="h-3.5 w-3.5" />
                    ) : ehRecebido ? (
                      <MessageCircle className="h-3.5 w-3.5" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-xs font-bold uppercase text-foreground">
                        {reg.tipo} {reg.direcao !== 'nenhuma' && `• ${reg.direcao}`}
                        {reg.contatos?.nome && ` (${reg.contatos.nome})`}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {formatarDataHora(reg.data || reg.created_at)}
                      </span>
                    </div>

                    {reg.texto && (
                      <p className="text-xs text-foreground mt-1 whitespace-pre-wrap">
                        {reg.texto}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal Adicionar Contato */}
      {modalNovoContato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Novo Contato</h3>
              <button
                onClick={() => setModalNovoContato(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAdicionarContato} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nome *
                </label>
                <Input
                  value={nomeNovoContato}
                  onChange={(e) => setNomeNovoContato(e.target.value)}
                  placeholder="Nome completo do contato"
                  required
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Cargo
                </label>
                <Input
                  value={cargoNovoContato}
                  onChange={(e) => setCargoNovoContato(e.target.value)}
                  placeholder="Ex: Gerente de Compras"
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  WhatsApp
                </label>
                <Input
                  value={waNovoContato}
                  onChange={(e) => setWaNovoContato(e.target.value)}
                  placeholder="Ex: 11999998888"
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  E-mail
                </label>
                <Input
                  type="email"
                  value={emailNovoContato}
                  onChange={(e) => setEmailNovoContato(e.target.value)}
                  placeholder="nome@construtora.com.br"
                  className="h-10 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalNovoContato(false)}
                  disabled={salvandoContato}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoContato}>
                  {salvandoContato ? 'Salvando...' : 'Adicionar Contato'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modais de Ações */}
      <DialogEnviei
        open={modalEnviei}
        onOpenChange={setModalEnviei}
        contatoId={contatoSelecionado?.id || contatos[0]?.id}
        contatoNome={contatoSelecionado?.nome || contatos[0]?.nome}
        clienteNome={cliente.nome}
        oportunidadeId={oportunidades[0]?.id}
        atalhosDias={atalhosDias}
        onSuccess={() => refetch()}
      />

      <DialogRespondeu
        open={modalRespondeu}
        onOpenChange={setModalRespondeu}
        contatoId={contatoSelecionado?.id || contatos[0]?.id}
        contatoNome={contatoSelecionado?.nome || contatos[0]?.nome}
        clienteNome={cliente.nome}
        oportunidadeId={oportunidades[0]?.id}
        onSuccess={() => refetch()}
      />

      {followupDestaque && (
        <DialogRemarcar
          open={modalRemarcar}
          onOpenChange={setModalRemarcar}
          followupId={followupDestaque.id}
          motivo={followupDestaque.motivo}
          dataAtual={followupDestaque.data}
          atalhosDias={atalhosDias}
          onSuccess={() => refetch()}
        />
      )}

      <DialogMesclarCliente
        open={modalMesclar}
        onOpenChange={setModalMesclar}
        clienteAtualId={clienteId}
        clienteAtualNome={cliente.nome}
        onSuccess={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ['prospects-lista'] });
        }}
      />
    </main>
  );
}
