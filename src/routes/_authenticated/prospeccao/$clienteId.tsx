import { useState, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  obterFichaCliente,
  atualizarCliente,
  adicionarContato,
  editarContato,
  concluirFollowup,
  salvarSituacaoMarca,
} from '@/lib/prospeccao.functions';
import { formatarData, formatarDataHora, formatarMesAno, statusData } from '@/lib/date-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { SeloPrado, SeloSituacaoMarca } from '@/components/prospeccao/selo-prado';
import { EtapaBadge } from '@/components/prospeccao/etapa-badge';
import { DialogEnviei } from '@/components/prospeccao/dialog-enviei';
import { DialogRespondeu } from '@/components/prospeccao/dialog-respondeu';
import { DialogRemarcar } from '@/components/prospeccao/dialog-remarcar';
import { DialogMesclarCliente } from '@/components/prospeccao/dialog-mesclar-cliente';
import { DialogRegistrarAtividade } from '@/components/prospeccao/dialog-registrar-atividade';
import { DialogOportunidade, type OportunidadeEdicao } from '@/components/prospeccao/dialog-oportunidade';
import { DialogIniciarObra } from '@/components/obras/dialog-iniciar-obra';
import { DialogCadastrarObraFechada } from '@/components/obras/dialog-cadastrar-obra-fechada';
import {
  DialogEditarRegistro,
  DialogExcluirRegistro,
  DialogEditarFollowup,
  DialogExcluirFollowup,
} from '@/components/prospeccao/dialogs-historico-followup';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
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
  AlertTriangle,
  FileText,
  Sparkles,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
  const [telNovoContato, setTelNovoContato] = useState('');
  const [waNovoContato, setWaNovoContato] = useState('');
  const [emailNovoContato, setEmailNovoContato] = useState('');
  const [salvandoContato, setSalvandoContato] = useState(false);

  // Estados para edição de contato
  const [modalEditarContato, setModalEditarContato] = useState(false);
  const [contatoEditandoId, setContatoEditandoId] = useState('');
  const [nomeContatoEdit, setNomeContatoEdit] = useState('');
  const [cargoContatoEdit, setCargoContatoEdit] = useState('');
  const [telContatoEdit, setTelContatoEdit] = useState('');
  const [waContatoEdit, setWaContatoEdit] = useState('');
  const [emailContatoEdit, setEmailContatoEdit] = useState('');
  const [salvandoEdicaoContato, setSalvandoEdicaoContato] = useState(false);

  // Estados de modais de ações
  const [modalEnviei, setModalEnviei] = useState(false);
  const [modalRespondeu, setModalRespondeu] = useState(false);
  const [modalRemarcar, setModalRemarcar] = useState(false);
  const [modalMesclar, setModalMesclar] = useState(false);
  const [modalAtividade, setModalAtividade] = useState(false);
  const [modalOportunidade, setModalOportunidade] = useState(false);
  const [oportunidadeEditando, setOportunidadeEditando] = useState<OportunidadeEdicao | null>(null);
  const [contatoSelecionado, setContatoSelecionado] = useState<any | null>(null);
  const [contatoAtividade, setContatoAtividade] = useState<any | null>(null);
  const [modalIniciarObra, setModalIniciarObra] = useState(false);
  const [opIniciarObraId, setOpIniciarObraId] = useState<string | null>(null);
  const [modalCadastrarObraFechada, setModalCadastrarObraFechada] = useState(false);

  // Estados de edição e exclusão de histórico e follow-ups
  const [registroEditando, setRegistroEditando] = useState<any | null>(null);
  const [registroExcluindo, setRegistroExcluindo] = useState<any | null>(null);
  const [followupEditando, setFollowupEditando] = useState<any | null>(null);
  const [followupExcluindo, setFollowupExcluindo] = useState<any | null>(null);
  const [followupRemarcando, setFollowupRemarcando] = useState<any | null>(null);

  // Server functions
  const fetchFicha = useServerFn(obterFichaCliente);
  const salvarCliente = useServerFn(atualizarCliente);
  const criarContato = useServerFn(adicionarContato);
  const salvarEdicaoContato = useServerFn(editarContato);
  const executarConcluirFollowup = useServerFn(concluirFollowup);
  const fnSalvarSituacaoMarca = useServerFn(salvarSituacaoMarca);

  // Modal Alterar Situação da Marca
  const [marcaAlterando, setMarcaAlterando] = useState<{
    id: string;
    nome: string;
    situacao: SituacaoPrado;
    representante?: string | null;
  } | null>(null);
  const [situacaoEdit, setSituacaoEdit] = useState<SituacaoPrado>('nao_verificado');
  const [repEdit, setRepEdit] = useState<string>('');
  const [salvandoSituacaoMarca, setSalvandoSituacaoMarca] = useState(false);

  function abrirModalAlterarSituacao(m: any) {
    setMarcaAlterando(m);
    setSituacaoEdit(m.situacao || 'nao_verificado');
    setRepEdit(m.representante || '');
  }

  async function handleSalvarSituacaoMarca(e: React.FormEvent) {
    e.preventDefault();
    if (!marcaAlterando) return;
    setSalvandoSituacaoMarca(true);
    try {
      await fnSalvarSituacaoMarca({
        data: {
          clienteId,
          marcaId: marcaAlterando.id,
          situacao: situacaoEdit,
          representante: situacaoEdit === 'atendida_outro_rep' ? repEdit.trim() : undefined,
        },
      });
      toast.success(`Situação da marca ${marcaAlterando.nome} atualizada com sucesso!`);
      setMarcaAlterando(null);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar situação da marca.');
    } finally {
      setSalvandoSituacaoMarca(false);
    }
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['ficha-cliente', clienteId],
    queryFn: () => fetchFicha({ data: { clienteId } }),
  });

  const cliente = data?.cliente;
  const contatos = data?.contatos || [];
  const oportunidades = data?.oportunidades || [];
  const marcas = data?.marcas || [];
  const followupDestaque = data?.followup_destaque;
  const registros = data?.registros || [];
  const atalhosDias = data?.configuracoes?.atalhos_dias || [3, 7, 15, 30];
  const situacoesMarca = data?.situacoes_marca || [];

  const marcasMap = useMemo(() => new Map(marcas.map((m: any) => [m.id, m])), [marcas]);
  const sitMap = useMemo(
    () => new Map(situacoesMarca.map((s: any) => [s.marca_id, s])),
    [situacoesMarca]
  );

  const marcasComSituacao = useMemo(() => {
    const idsNasOportunidades = new Set<string>();
    oportunidades.forEach((op: any) => {
      (op.marca_ids || []).forEach((mid: string) => idsNasOportunidades.add(mid));
    });

    const resultado: Array<{
      id: string;
      nome: string;
      situacao: SituacaoPrado;
      representante?: string | null;
      isPrado: boolean;
    }> = [];

    idsNasOportunidades.forEach((mid) => {
      const m = marcasMap.get(mid);
      const nome = m?.nome || 'Marca';
      const isPrado = nome.trim().toUpperCase() === 'PRADO';
      if (isPrado) {
        resultado.push({
          id: mid,
          nome,
          situacao: (cliente?.situacao_prado || 'nao_verificado') as SituacaoPrado,
          representante: cliente?.representante_prado || null,
          isPrado: true,
        });
      } else {
        const sit = sitMap.get(mid);
        resultado.push({
          id: mid,
          nome,
          situacao: (sit?.situacao || 'nao_verificado') as SituacaoPrado,
          representante: sit?.representante || null,
          isPrado: false,
        });
      }
    });

    resultado.sort((a, b) => {
      if (a.isPrado && !b.isPrado) return -1;
      if (!a.isPrado && b.isPrado) return 1;
      return a.nome.localeCompare(b.nome);
    });

    return resultado;
  }, [oportunidades, marcasMap, sitMap, cliente?.situacao_prado, cliente?.representante_prado]);

  const marcasAtendidasOutroRep = useMemo(() => {
    const list = marcasComSituacao.filter((m) => m.situacao === 'atendida_outro_rep');
    const pradoJaInclusa = list.some((m) => m.isPrado);
    if (!pradoJaInclusa && cliente?.situacao_prado === 'atendida_outro_rep') {
      const pradoMarca = marcas.find((m: any) => m.nome?.trim()?.toUpperCase() === 'PRADO');
      list.unshift({
        id: pradoMarca?.id || 'prado',
        nome: pradoMarca?.nome || 'PRADO',
        situacao: 'atendida_outro_rep',
        representante: cliente?.representante_prado || null,
        isPrado: true,
      });
    }
    return list;
  }, [marcasComSituacao, cliente?.situacao_prado, cliente?.representante_prado, marcas]);

  // Regra 1.2: Valor inicial do contato: o contato da oportunidade em foco, se houver; senão o contato selecionado; senão o primeiro.
  const opEmFoco = followupDestaque?.oportunidade_id
    ? oportunidades.find((o: any) => o.id === followupDestaque.oportunidade_id)
    : null;
  const contatoDaOpEmFoco = opEmFoco?.contato_id
    ? contatos.find((c: any) => c.id === opEmFoco.contato_id)
    : null;
  const contatoInicial =
    contatoDaOpEmFoco ||
    contatoSelecionado ||
    (followupDestaque?.contato_id ? contatos.find((c: any) => c.id === followupDestaque.contato_id) : null) ||
    contatos[0] ||
    null;

  function abrirCriarOportunidade() {
    setOportunidadeEditando(null);
    setModalOportunidade(true);
  }

  function abrirIniciarObra(opId: string) {
    setOpIniciarObraId(opId);
    setModalIniciarObra(true);
  }

  function abrirEditarOportunidade(op: any) {
    setOportunidadeEditando({
      id: op.id,
      marca_ids: op.marca_ids || [],
      descricao: op.descricao,
      contato_id: op.contato_id,
      etapa: op.etapa,
    });
    setModalOportunidade(true);
  }

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
          telefone: telNovoContato.trim() || undefined,
          whatsapp: waNovoContato.trim() || undefined,
          email: emailNovoContato.trim() || undefined,
        },
      });

      toast.success('Novo contato adicionado com sucesso!');
      setModalNovoContato(false);
      setNomeNovoContato('');
      setCargoNovoContato('');
      setTelNovoContato('');
      setWaNovoContato('');
      setEmailNovoContato('');
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar contato.');
    } finally {
      setSalvandoContato(false);
    }
  }

  function abrirEditarContato(contato: any) {
    setContatoEditandoId(contato.id);
    setNomeContatoEdit(contato.nome || '');
    setCargoContatoEdit(contato.cargo || '');
    setTelContatoEdit(contato.telefone || '');
    setWaContatoEdit(contato.whatsapp || '');
    setEmailContatoEdit(contato.email || '');
    setModalEditarContato(true);
  }

  async function handleSalvarEdicaoContato(e: React.FormEvent) {
    e.preventDefault();
    if (!nomeContatoEdit.trim()) {
      toast.error('Informe o nome do contato.');
      return;
    }

    setSalvandoEdicaoContato(true);
    try {
      await salvarEdicaoContato({
        data: {
          id: contatoEditandoId,
          nome: nomeContatoEdit.trim(),
          cargo: cargoContatoEdit.trim() || undefined,
          telefone: telContatoEdit.trim() || undefined,
          whatsapp: waContatoEdit.trim() || undefined,
          email: emailContatoEdit.trim() || undefined,
        },
      });

      toast.success('Contato atualizado com sucesso!');
      setModalEditarContato(false);
      refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao editar contato.');
    } finally {
      setSalvandoEdicaoContato(false);
    }
  }

  function abrirAtividade(contato?: any) {
    setContatoAtividade(contato || null);
    setModalAtividade(true);
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

        <div className="flex items-center gap-2">
          {/* Botão + Atividade Geral */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => abrirAtividade()}
            className="gap-1.5 font-semibold text-xs h-9"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            + Atividade
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
                  <option value="ja_cliente">Já é cliente</option>
                  <option value="atendida_outro_rep">Atendido por outro representante</option>
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

            {/* Aviso vermelho para marcas atendidas por outro representante */}
            {marcasAtendidasOutroRep.length > 0 && (
              <div className="mt-3 space-y-2">
                {marcasAtendidasOutroRep.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      <strong>Atenção:</strong> A marca <strong>{m.nome}</strong> é atendida por outro representante (
                      {m.representante || 'outro representante'}).
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 1.1 Bloco Situação por marca */}
      {marcasComSituacao.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Situação por marca
              </h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {marcasComSituacao.length} {marcasComSituacao.length === 1 ? 'marca' : 'marcas'} nas oportunidades
            </span>
          </div>

          <div className="space-y-2.5">
            {marcasComSituacao.map((m) => (
              <div
                key={m.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-border bg-accent/20 hover:bg-accent/30 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-semibold text-sm text-foreground">{m.nome}</span>
                  <SeloSituacaoMarca
                    marcaNome={m.nome}
                    situacao={m.situacao}
                    representante={m.representante}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => abrirModalAlterarSituacao(m)}
                  className="h-8 text-xs font-semibold gap-1.5 self-start sm:self-auto shrink-0"
                >
                  <Edit2 className="h-3 w-3" />
                  Alterar
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

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
                variant="outline"
                onClick={() => abrirAtividade()}
                className="h-10 px-3 text-xs font-semibold gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                + Atividade
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setFollowupRemarcando(followupDestaque);
                  setModalRemarcar(true);
                }}
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

              <Button
                size="sm"
                variant="outline"
                onClick={() => setFollowupEditando(followupDestaque)}
                className="h-10 px-3 text-xs font-semibold gap-1.5"
              >
                <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                Editar
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFollowupExcluindo(followupDestaque)}
                className="h-10 px-3 text-xs font-semibold text-muted-foreground hover:text-destructive gap-1.5"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            </div>

            {data?.followups_pendentes && data.followups_pendentes.length > 1 && (
              <div className="pt-3 border-t border-border/60 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Outros follow-ups pendentes ({data.followups_pendentes.length - 1}):
                </p>
                <div className="space-y-2">
                  {data.followups_pendentes.slice(1).map((fup: any) => (
                    <div
                      key={fup.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg border border-border bg-card text-xs shadow-2xs"
                    >
                      <div>
                        <span className="font-semibold text-foreground">{fup.motivo}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Agendado para {formatarData(fup.data)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleConcluirFollowup(fup.id)}
                          className="h-7 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 gap-1"
                        >
                          <Check className="h-3 w-3" />
                          Feito
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setFollowupRemarcando(fup);
                            setModalRemarcar(true);
                          }}
                          className="h-7 px-2.5 text-[11px] font-medium"
                        >
                          Remarcar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFollowupEditando(fup)}
                          className="h-7 px-2.5 text-[11px] font-medium"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setFollowupExcluindo(fup)}
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                const numeroTelLimpo = (contato.telefone || '').replace(/\D/g, '');
                const telParaLigar = numeroTelLimpo || numeroWaLimpo;

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
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
                          {contato.telefone && (
                            <span>Fixo: {contato.telefone}</span>
                          )}
                          {contato.whatsapp && (
                            <span>WA: {contato.whatsapp}</span>
                          )}
                        </div>
                      </div>
                      {contato.tentativas_sem_resposta > 0 && (
                        <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                          {contato.tentativas_sem_resposta}ª tentativa
                        </span>
                      )}
                    </div>

                    {/* Botões de Ação Direta: WhatsApp, Ligar, E-mail, + Atividade, Editar */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/60">
                      {numeroWaLimpo ? (
                        <a
                          href={`https://wa.me/${numeroWaLimpo}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold transition-colors"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium bg-muted text-muted-foreground px-2 py-1 rounded border border-border">
                          Sem WhatsApp
                        </span>
                      )}

                      {telParaLigar ? (
                        <a
                          href={`tel:${telParaLigar}`}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-blue-600/10 hover:bg-blue-600/20 text-blue-700 dark:text-blue-400 text-xs font-semibold transition-colors"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Ligar
                        </a>
                      ) : null}

                      {contato.email && (
                        <a
                          href={`mailto:${contato.email}`}
                          className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md bg-purple-600/10 hover:bg-purple-600/20 text-purple-700 dark:text-purple-400 text-xs font-semibold transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5" />
                          E-mail
                        </a>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirAtividade(contato)}
                        className="h-8 px-2.5 text-xs font-semibold gap-1 text-primary hover:text-primary"
                      >
                        <Sparkles className="h-3 w-3" />
                        + Atividade
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirEditarContato(contato)}
                        className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                      >
                        <Edit2 className="h-3 w-3" />
                        Editar
                      </Button>
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
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModalCadastrarObraFechada(true)}
                className="h-8 text-xs gap-1 font-semibold"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" />
                Cadastrar obra já fechada
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={abrirCriarOportunidade}
                className="h-8 text-xs gap-1 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Nova oportunidade
              </Button>
            </div>
          </div>

          {oportunidades.length === 0 ? (
            <div className="py-4 text-center space-y-2">
              <p className="text-xs text-muted-foreground italic">
                Nenhuma oportunidade cadastrada.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={abrirCriarOportunidade}
                className="h-8 text-xs gap-1 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Cadastrar oportunidade
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {oportunidades.map((op: any) => {
                const contatoVinculado = contatos.find((c: any) => c.id === op.contato_id);
                return (
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
                      <div className="flex items-center gap-2">
                        <EtapaBadge etapa={op.etapa} />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => abrirEditarOportunidade(op)}
                          className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground gap-1"
                        >
                          <Edit2 className="h-3 w-3" />
                          Editar
                        </Button>
                      </div>
                    </div>

                    {contatoVinculado && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          Contato:{' '}
                          <strong className="text-foreground">{contatoVinculado.nome}</strong>
                          {contatoVinculado.cargo && ` (${contatoVinculado.cargo})`}
                        </span>
                      </p>
                    )}

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

                    {/* Gestão da Obra (Marca PRADO) */}
                    {op.marcas?.some((m: any) => m.nome?.trim().toUpperCase() === 'PRADO') && (
                      <div className="pt-2 border-t border-border/60 flex items-center justify-end">
                        {op.obra_id ? (
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-semibold gap-1.5 text-primary hover:text-primary"
                          >
                            <Link to="/obras-prado/$obraId" params={{ obraId: op.obra_id }}>
                              <Building2 className="h-3.5 w-3.5" />
                              Ver obra
                            </Link>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => abrirIniciarObra(op.id)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <Building2 className="h-3.5 w-3.5" />
                            Iniciar gestão da obra
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                        {reg.tipo === 'outro' ? 'Atividade' : reg.tipo} {reg.direcao !== 'nenhuma' && `• ${reg.direcao}`}
                        {reg.contatos?.nome && ` (${reg.contatos.nome})`}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          {formatarDataHora(reg.data || reg.created_at)}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                              <span className="sr-only">Opções</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-28">
                            <DropdownMenuItem
                              onClick={() => setRegistroEditando(reg)}
                              className="gap-2 text-xs cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setRegistroExcluindo(reg)}
                              className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
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
                  Telefone (fixo)
                </label>
                <Input
                  value={telNovoContato}
                  onChange={(e) => setTelNovoContato(e.target.value)}
                  placeholder="Ex: 1133334444"
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

      {/* Modal Editar Contato */}
      {modalEditarContato && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card border border-border p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold">Editar Contato</h3>
              <button
                onClick={() => setModalEditarContato(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSalvarEdicaoContato} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nome *
                </label>
                <Input
                  value={nomeContatoEdit}
                  onChange={(e) => setNomeContatoEdit(e.target.value)}
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
                  value={cargoContatoEdit}
                  onChange={(e) => setCargoContatoEdit(e.target.value)}
                  placeholder="Ex: Gerente de Compras"
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Telefone (fixo)
                </label>
                <Input
                  value={telContatoEdit}
                  onChange={(e) => setTelContatoEdit(e.target.value)}
                  placeholder="Ex: 1133334444"
                  className="h-10 bg-background"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  WhatsApp
                </label>
                <Input
                  value={waContatoEdit}
                  onChange={(e) => setWaContatoEdit(e.target.value)}
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
                  value={emailContatoEdit}
                  onChange={(e) => setEmailContatoEdit(e.target.value)}
                  placeholder="nome@construtora.com.br"
                  className="h-10 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModalEditarContato(false)}
                  disabled={salvandoEdicaoContato}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={salvandoEdicaoContato}>
                  {salvandoEdicaoContato ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modais de Ações */}
      <DialogRegistrarAtividade
        open={modalAtividade}
        onOpenChange={setModalAtividade}
        clienteId={clienteId}
        clienteNome={cliente.nome}
        contatoId={contatoAtividade?.id}
        contatos={contatos}
        oportunidades={oportunidades}
        atalhosDias={atalhosDias}
        onSuccess={() => refetch()}
      />
      <DialogOportunidade
        open={modalOportunidade}
        onOpenChange={setModalOportunidade}
        clienteId={clienteId}
        clienteNome={cliente.nome}
        clienteSituacaoPrado={cliente.situacao_prado}
        clienteRepresentantePrado={cliente.representante_prado}
        oportunidade={oportunidadeEditando}
        contatos={contatos}
        marcasDisponiveis={marcas}
        situacoesMarca={data?.situacoes_marca || []}
        onSuccess={() => refetch()}
      />
      <DialogEnviei
        open={modalEnviei}
        onOpenChange={setModalEnviei}
        contatoId={contatoInicial?.id}
        contatoNome={contatoInicial?.nome}
        contatos={contatos}
        clienteNome={cliente.nome}
        oportunidades={oportunidades}
        atalhosDias={atalhosDias}
        onSuccess={() => refetch()}
      />

      <DialogRespondeu
        open={modalRespondeu}
        onOpenChange={setModalRespondeu}
        contatoId={contatoInicial?.id}
        contatoNome={contatoInicial?.nome}
        contatos={contatos}
        clienteNome={cliente.nome}
        oportunidades={oportunidades}
        onSuccess={() => refetch()}
      />

      <DialogCadastrarObraFechada
        open={modalCadastrarObraFechada}
        onOpenChange={setModalCadastrarObraFechada}
        clienteId={clienteId}
        clienteNome={cliente.nome}
        clienteSituacaoPrado={cliente.situacao_prado}
        clienteRepresentantePrado={cliente.representante_prado}
        contatos={contatos}
        onSuccess={() => refetch()}
      />

      {(followupRemarcando || followupDestaque) && (
        <DialogRemarcar
          open={modalRemarcar}
          onOpenChange={(aberto) => {
            setModalRemarcar(aberto);
            if (!aberto) setFollowupRemarcando(null);
          }}
          followupId={(followupRemarcando || followupDestaque)?.id}
          motivo={(followupRemarcando || followupDestaque)?.motivo}
          dataAtual={(followupRemarcando || followupDestaque)?.data}
          atalhosDias={atalhosDias}
          onSuccess={() => refetch()}
        />
      )}

      {/* Modais de Histórico e Follow-up (Editar / Excluir) */}
      <DialogEditarRegistro
        open={!!registroEditando}
        onOpenChange={(aberto) => !aberto && setRegistroEditando(null)}
        registro={registroEditando}
        onSucesso={() => refetch()}
      />

      <DialogExcluirRegistro
        open={!!registroExcluindo}
        onOpenChange={(aberto) => !aberto && setRegistroExcluindo(null)}
        registro={registroExcluindo}
        temAnexos={!!(registroExcluindo?.arquivos && registroExcluindo.arquivos.length > 0)}
        onSucesso={() => refetch()}
      />

      <DialogEditarFollowup
        open={!!followupEditando}
        onOpenChange={(aberto) => !aberto && setFollowupEditando(null)}
        followup={followupEditando}
        onSucesso={() => refetch()}
      />

      <DialogExcluirFollowup
        open={!!followupExcluindo}
        onOpenChange={(aberto) => !aberto && setFollowupExcluindo(null)}
        followup={followupExcluindo}
        onSucesso={() => refetch()}
      />

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

      <DialogIniciarObra
        open={modalIniciarObra}
        onOpenChange={setModalIniciarObra}
        oportunidadeId={opIniciarObraId}
        clienteNome={cliente?.nome}
      />

      {/* Modal Alterar Situação da Marca */}
      {marcaAlterando && (
        <Dialog open={!!marcaAlterando} onOpenChange={(open) => !open && setMarcaAlterando(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Alterar Situação: {marcaAlterando.nome}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {cliente?.nome}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSalvarSituacaoMarca} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Situação comercial *
                </label>
                <select
                  value={situacaoEdit}
                  onChange={(e) => setSituacaoEdit(e.target.value as SituacaoPrado)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs font-medium focus:ring-2 focus:ring-primary"
                >
                  <option value="nao_verificado">Não verificado</option>
                  <option value="livre">Livre</option>
                  <option value="ja_cliente">Já é cliente</option>
                  <option value="atendida_outro_rep">Atendido por outro representante</option>
                </select>
              </div>

              {situacaoEdit === 'atendida_outro_rep' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-xs font-semibold text-destructive block">
                    Nome do representante
                  </label>
                  <Input
                    placeholder="Ex: Carlos Silva"
                    value={repEdit}
                    onChange={(e) => setRepEdit(e.target.value)}
                    className="h-10 bg-card text-xs"
                  />
                </div>
              )}

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMarcaAlterando(null)}
                  disabled={salvandoSituacaoMarca}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={salvandoSituacaoMarca}
                  className="font-semibold"
                >
                  {salvandoSituacaoMarca ? 'Salvando...' : 'Salvar Situação'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </main>
  );
}
