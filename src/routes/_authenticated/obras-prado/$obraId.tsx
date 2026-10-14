import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import {
  obterObra,
  reabrirObra,
  resolverProblema,
  marcarItemChecklist,
  editarLote,
  excluirArquivo,
  excluirEntrega,
  TIPOS_LOTE_LABELS,
  STATUS_LOTE_LABELS,
  type Entrega,
  type TipoLote,
} from '@/lib/obras.functions';
import {
  concluirFollowup,
  cancelarFollowup,
} from '@/lib/prospeccao.functions';
import { formatarData, formatarDataHora, diasAteData, obterHojeSP } from '@/lib/date-utils';
import { VisualizadorArquivo, type ArquivoParaVisualizar } from '@/components/obras/visualizador-arquivo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DialogProblema } from '@/components/obras/dialog-problema';
import { DialogFinalizarObra } from '@/components/obras/dialog-finalizar-obra';
import { DialogNotaObra } from '@/components/obras/dialog-nota-obra';
import { DialogNovoLote } from '@/components/obras/dialog-novo-lote';
import { DialogEditarLote } from '@/components/obras/dialog-editar-lote';
import { DialogEditarObra } from '@/components/obras/dialog-editar-obra';
import { DialogNovoFollowupObra, type ModeloFollowup } from '@/components/obras/dialog-novo-followup-obra';
import { DialogRemarcar } from '@/components/prospeccao/dialog-remarcar';
import { DialogAcaoEtapaLote, type AcaoEtapaTipo } from '@/components/obras/dialog-acao-etapa-lote';
import { DialogEnviarArquivos } from '@/components/obras/dialog-enviar-arquivos';
import { DialogFormEntrega } from '@/components/obras/dialog-form-entrega';
import { DialogRegistrarEntregaParcial } from '@/components/obras/dialog-registrar-entrega-parcial';
import { DialogImportarCronograma } from '@/components/obras/dialog-importar-cronograma';
import {
  Building2,
  ArrowLeft,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  FileText,
  UploadCloud,
  ExternalLink,
  Trash2,
  Plus,
  Edit2,
  Clock,
  Sparkles,
  AlertCircle,
  RotateCcw,
  Check,
  Factory,
  Truck,
  CheckCheck,
  Paperclip,
} from 'lucide-react';
import { toast } from 'sonner';

export const Route = createFileRoute('/_authenticated/obras-prado/$obraId')({
  head: () => ({
    meta: [
      { title: 'Ficha da Obra | GAL Gestão' },
      { name: 'description', content: 'Acompanhamento detalhado de lotes, medições e checklist da obra.' },
    ],
  }),
  component: FichaObraPage,
});

function FichaObraPage() {
  const { obraId } = Route.useParams();
  const queryClient = useQueryClient();

  // Estados de abas e modais
  const [abaAtiva, setAbaAtiva] = useState('lotes');

  // Modais de cabeçalho
  const [modalProblema, setModalProblema] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modalEditarObra, setModalEditarObra] = useState(false);
  const [modalNota, setModalNota] = useState(false);
  const [notaLoteId, setNotaLoteId] = useState<string | null>(null);

  // Follow-ups da obra
  const [modalNovoFollowup, setModalNovoFollowup] = useState(false);
  const [modeloFollowup, setModeloFollowup] = useState<ModeloFollowup>('livre');
  const [fupRemarcando, setFupRemarcando] = useState<any | null>(null);

  // Concluir Checklist com data
  const [itemConcluindo, setItemConcluindo] = useState<any | null>(null);
  const [dataConclusaoChecklist, setDataConclusaoChecklist] = useState<string>(obterHojeSP());

  // Modais de Lotes
  const [modalNovoLote, setModalNovoLote] = useState(false);
  const [modalEditarLote, setModalEditarLote] = useState(false);
  const [loteEditando, setLoteEditando] = useState<any | null>(null);

  // Ações de Etapa de Lote
  const [modalAcaoEtapa, setModalAcaoEtapa] = useState(false);
  const [tipoAcaoEtapa, setTipoAcaoEtapa] = useState<AcaoEtapaTipo | null>(null);
  const [loteAcaoEtapa, setLoteAcaoEtapa] = useState<any | null>(null);

  // Arquivos
  const [modalEnviarArquivos, setModalEnviarArquivos] = useState(false);
  const [arquivoExcluindo, setArquivoExcluindo] = useState<any | null>(null);
  const [arquivoVisualizando, setArquivoVisualizando] = useState<ArquivoParaVisualizar | null>(null);

  // Entregas Parciais
  const [modalFormEntrega, setModalFormEntrega] = useState(false);
  const [loteEntrega, setLoteEntrega] = useState<any | null>(null);
  const [entregaEditando, setEntregaEditando] = useState<Entrega | null>(null);
  const [modalRegistrarEntrega, setModalRegistrarEntrega] = useState(false);
  const [entregaRegistrando, setEntregaRegistrando] = useState<Entrega | null>(null);
  const [entregaParaExcluir, setEntregaParaExcluir] = useState<Entrega | null>(null);
  const [excluindoEntrega, setExcluindoEntrega] = useState(false);
  const [modalImportarCronograma, setModalImportarCronograma] = useState(false);
  const [loteImportandoCronograma, setLoteImportandoCronograma] = useState<any | null>(null);

  // Edição de nota em item do checklist
  const [editandoNotaItemId, setEditandoNotaItemId] = useState<string | null>(null);
  const [textoNotaItem, setTextoNotaItem] = useState('');

  // Server functions
  const fetchObra = useServerFn(obterObra);
  const executarReabrirObra = useServerFn(reabrirObra);
  const executarResolverProblema = useServerFn(resolverProblema);
  const executarMarcarChecklist = useServerFn(marcarItemChecklist);
  const executarEditarLote = useServerFn(editarLote);
  const executarExcluirEntrega = useServerFn(excluirEntrega);
  const executarExcluirArquivo = useServerFn(excluirArquivo);
  const executarConcluirFup = useServerFn(concluirFollowup);
  const executarCancelarFup = useServerFn(cancelarFollowup);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['obra-detalhes', obraId],
    queryFn: () => fetchObra({ data: { obraId } }),
  });

  const obra = data?.obra;
  const cliente = data?.cliente;
  const oportunidade = data?.oportunidade;
  const lotes = data?.lotes || [];
  const checklist = data?.checklist || [];
  const registros = data?.registros || [];
  const arquivos = data?.arquivos || [];
  const followups = data?.followups || [];

  if (isLoading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="h-6 w-32 bg-muted rounded animate-pulse" />
        <div className="h-28 rounded-xl border border-border bg-card p-6 animate-pulse" />
        <div className="h-96 rounded-xl border border-border bg-card p-6 animate-pulse" />
      </main>
    );
  }

  if (!obra) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-foreground">Obra não encontrada</h1>
        <p className="text-sm text-muted-foreground">A obra solicitada não existe ou foi removida.</p>
        <Button asChild variant="outline">
          <Link to="/obras-prado">Voltar para a lista de obras</Link>
        </Button>
      </main>
    );
  }

  const hoje = obterHojeSP();
  const algumLoteFeriasPendente = lotes.some((l: any) => !!l.ferias_pendente);
  const checklistConcluidos = checklist.filter((i: any) => !!i.feito).length;

  const registrosMedicaoIds = new Set(
    registros.filter((r: any) => r.tipo === 'medicao').map((r: any) => r.id)
  );

  const lotesMedidos = lotes
    .filter((l: any) => !!l.medido_em)
    .sort((a: any, b: any) => String(a.medido_em).localeCompare(String(b.medido_em)));
  const lotesPrevistos = lotes
    .filter((l: any) => !l.medido_em && !!l.previsao_medicao)
    .sort((a: any, b: any) => String(a.previsao_medicao).localeCompare(String(b.previsao_medicao)));
  const painelMedicoes = [...lotesMedidos, ...lotesPrevistos];
  const lotesSemMedicao = lotes.filter((l: any) => !l.medido_em && !l.previsao_medicao);

  async function handleResolverProblema() {
    try {
      await executarResolverProblema({ data: { obraId } });
      toast.success('Problema marcado como resolvido.');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao resolver problema.');
    }
  }

  async function handleReabrirObra() {
    try {
      await executarReabrirObra({ data: { obraId } });
      toast.success('Obra reaberta com sucesso.');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao reabrir obra.');
    }
  }

  async function handleToggleChecklist(item: any) {
    try {
      await executarMarcarChecklist({
        data: {
          itemId: item.id,
          feito: !item.feito,
          obraId,
        },
      });
      toast.success(item.feito ? 'Item desmarcado.' : 'Item marcado como feito.');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar checklist.');
    }
  }

  async function handleConfirmarConclusaoChecklist() {
    if (!itemConcluindo) return;
    try {
      await executarMarcarChecklist({
        data: {
          itemId: itemConcluindo.id,
          feito: true,
          data: dataConclusaoChecklist || obterHojeSP(),
          obraId,
        },
      });
      toast.success('Item marcado como feito.');
      setItemConcluindo(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar checklist.');
    }
  }

  async function handleConcluirFollowupObra(id: string) {
    try {
      await executarConcluirFup({ data: { id } });
      toast.success('Follow-up marcado como concluído!');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao concluir follow-up.');
    }
  }

  async function handleCancelarFollowupObra(id: string) {
    try {
      await executarCancelarFup({ data: { id } });
      toast.success('Follow-up cancelado com sucesso.');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar follow-up.');
    }
  }

  async function handleSalvarNotaChecklist(item: any) {
    try {
      await executarMarcarChecklist({
        data: {
          itemId: item.id,
          feito: item.feito,
          nota: textoNotaItem.trim() || null,
          obraId,
        },
      });
      toast.success('Nota do checklist atualizada.');
      setEditandoNotaItemId(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar nota.');
    }
  }

  async function handleCadastroCompletoDireto(loteId: string) {
    try {
      await executarEditarLote({
        data: {
          loteId,
          obraId,
          cadastro_completo: true,
        },
      });
      toast.success('Cadastro do lote confirmado como completo.');
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao confirmar cadastro do lote.');
    }
  }

  function abrirAcaoEtapa(tipo: AcaoEtapaTipo, lote: any) {
    setLoteAcaoEtapa(lote);
    setTipoAcaoEtapa(tipo);
    setModalAcaoEtapa(true);
  }

  function abrirEditarLote(lote: any) {
    setLoteEditando(lote);
    setModalEditarLote(true);
  }

  function abrirRegistrarNota(loteId?: string) {
    setNotaLoteId(loteId || null);
    setModalNota(true);
  }

  function handleVerArquivo(arq: {
    nome: string;
    mime?: string | null | undefined;
    caminho: string;
    tamanho?: number | null | undefined;
  }) {
    setArquivoVisualizando({
      nome: arq.nome,
      mime: arq.mime ?? null,
      caminho: arq.caminho,
      tamanho: arq.tamanho ?? null,
    });
  }

  async function handleConfirmarExcluirArquivo() {
    if (!arquivoExcluindo) return;
    try {
      await executarExcluirArquivo({ data: { arquivoId: arquivoExcluindo.id } });
      toast.success('Arquivo removido com sucesso.');
      setArquivoExcluindo(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir arquivo.');
    }
  }

  function abrirNovaEntrega(lote: any) {
    setLoteEntrega(lote);
    setEntregaEditando(null);
    setModalFormEntrega(true);
  }

  function abrirImportarCronograma(lote: any) {
    setLoteImportandoCronograma(lote);
    setModalImportarCronograma(true);
  }

  function abrirEditarEntrega(lote: any, entrega: Entrega) {
    setLoteEntrega(lote);
    setEntregaEditando(entrega);
    setModalFormEntrega(true);
  }

  function abrirRegistrarEntrega(lote: any, entrega: Entrega) {
    setLoteEntrega(lote);
    setEntregaRegistrando(entrega);
    setModalRegistrarEntrega(true);
  }

  async function handleConfirmarExcluirEntrega() {
    if (!entregaParaExcluir) return;
    try {
      setExcluindoEntrega(true);
      await executarExcluirEntrega({
        data: {
          obraId,
          entregaId: entregaParaExcluir.id,
        },
      });
      toast.success(`Entrega ${entregaParaExcluir.numero} excluída com sucesso.`);
      setEntregaParaExcluir(null);
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir entrega.');
    } finally {
      setExcluindoEntrega(false);
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {/* Botão Voltar */}
      <div>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Link to="/obras-prado">
            <ArrowLeft className="h-4 w-4" />
            Voltar para lista de obras
          </Link>
        </Button>
      </div>

      {/* 2.3 Ficha da obra — Topo */}
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
        {/* Faixa Vermelha de Problema Ativo */}
        {obra.problema_ativo && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-destructive">
                  Problema Ativo na Obra
                </p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {obra.problema_texto || 'Ocorrência operacional registrada.'}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResolverProblema}
              className="bg-card hover:bg-accent text-xs font-semibold gap-1.5 self-start sm:self-center shrink-0 border-destructive/40 text-destructive hover:text-destructive"
            >
              <Check className="h-3.5 w-3.5" />
              Marcar como Resolvido
            </Button>
          </div>
        )}

        {/* Aviso Amarelo de Férias Coletivas Pendentes */}
        {algumLoteFeriasPendente && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-2.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Datas das férias coletivas da Prado não cadastradas no sistema. Previsões de entrega podem mudar.
            </span>
          </div>
        )}

        {/* Informações Principais da Obra e Ações */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                {obra.nome}
              </h1>
              {obra.finalizada_em && (
                <Badge variant="secondary" className="text-xs font-bold">
                  Finalizada em {formatarData(obra.finalizada_em)}
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
              {cliente && (
                <span className="flex items-center gap-1 font-medium">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Construtora:{' '}
                  <Link
                    to="/prospeccao/$clienteId"
                    params={{ clienteId: cliente.id }}
                    className="text-foreground hover:underline font-bold"
                  >
                    {cliente.nome}
                  </Link>
                </span>
              )}
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
          </div>

          {/* Botões de Ação no Topo */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalEditarObra(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Edit2 className="h-3.5 w-3.5" />
              Editar obra
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalProblema(true)}
              className="gap-1.5 text-xs font-semibold text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Problema na obra
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => abrirRegistrarNota()}
              className="gap-1.5 text-xs font-semibold"
            >
              <FileText className="h-3.5 w-3.5" />
              Registrar nota
            </Button>

            {obra.finalizada_em ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReabrirObra}
                className="gap-1.5 text-xs font-semibold"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reabrir obra
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setModalFinalizar(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Finalizar obra
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2.4 Abas Operacionais: Lotes | Checklist | Histórico | Arquivos */}
      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full sm:w-auto h-11 p-1 bg-card border border-border">
          <TabsTrigger value="lotes" className="text-xs font-bold gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Lotes ({lotes.length})
          </TabsTrigger>
          <TabsTrigger value="checklist" className="text-xs font-bold gap-1.5">
            <CheckCheck className="h-3.5 w-3.5" />
            Checklist ({checklistConcluidos}/9)
          </TabsTrigger>
          <TabsTrigger value="historico" className="text-xs font-bold gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            Histórico ({registros.length})
          </TabsTrigger>
          <TabsTrigger value="arquivos" className="text-xs font-bold gap-1.5">
            <UploadCloud className="h-3.5 w-3.5" />
            Arquivos ({arquivos.length})
          </TabsTrigger>
        </TabsList>

        {/* ABA: LOTES */}
        <TabsContent value="lotes" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-medium">
              Controle de produção por lote, medições e datas de entrega.
            </p>
            <Button
              size="sm"
              onClick={() => setModalNovoLote(true)}
              className="gap-1.5 text-xs font-semibold h-8"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo lote
            </Button>
          </div>

          {/* Painel Medições no topo da aba Lotes */}
          {lotes.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Painel de Medições</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Cronograma e acompanhamento das medições por lote
                    </p>
                  </div>
                </div>

                {painelMedicoes.length > 0 && (
                  <Badge variant="outline" className="text-xs font-semibold self-start sm:self-auto">
                    {lotesMedidos.length} de {painelMedicoes.length} medições realizadas
                  </Badge>
                )}
              </div>

              {painelMedicoes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-1">
                  Nenhum lote possui data de medição (efetiva ou prevista) cadastrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {painelMedicoes.map((loteItem: any, index: number) => {
                    const tipoLegivel =
                      TIPOS_LOTE_LABELS[loteItem.tipo as TipoLote] || loteItem.tipo;
                    const isMedido = !!loteItem.medido_em;
                    const prevLimpa = loteItem.previsao_medicao ? loteItem.previsao_medicao.slice(0, 10) : '';
                    const dataAtrasada = !isMedido && prevLimpa && prevLimpa < hoje;

                    // Arquivos vinculados à medição deste lote
                    const arqsMedicao = arquivos.filter(
                      (arq: any) =>
                        arq.lote_id === loteItem.id &&
                        arq.registro_id &&
                        registrosMedicaoIds.has(arq.registro_id)
                    );

                    return (
                      <div
                        key={loteItem.id}
                        className={`p-3 rounded-lg border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs ${
                          isMedido
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-background border-border/70'
                        }`}
                      >
                        {/* 1. Nº e Tipo + Descrição */}
                        <div className="flex items-center gap-2.5 min-w-[220px]">
                          <Badge
                            variant={isMedido ? 'default' : 'secondary'}
                            className={`font-bold text-[11px] shrink-0 ${
                              isMedido ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''
                            }`}
                          >
                            {index + 1}ª medição
                          </Badge>
                          <div className="font-semibold text-foreground">
                            {tipoLegivel}
                            {loteItem.descricao && (
                              <span className="text-muted-foreground font-normal ml-1">
                                ({loteItem.descricao})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. Status / Data */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isMedido ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Medido em {formatarData(loteItem.medido_em)}
                            </span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1.5 font-semibold ${
                                dataAtrasada
                                  ? 'text-destructive'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {dataAtrasada ? (
                                <AlertTriangle className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                              Prevista para {formatarData(loteItem.previsao_medicao)}
                            </span>
                          )}
                        </div>

                        {/* 3. Quantidade */}
                        <div className="text-muted-foreground shrink-0 font-medium text-[11px]">
                          {loteItem.quantidade != null ? (
                            <span>
                              <strong className="text-foreground">{loteItem.quantidade}</strong> peças
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </div>

                        {/* 4. Anexos da Medição com Ver */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {arqsMedicao.length > 0 ? (
                            arqsMedicao.map((arq: any) => (
                              <Button
                                key={arq.id}
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleVerArquivo(arq)}
                                className="h-7 px-2.5 text-xs gap-1.5 border-border/80 hover:border-primary text-foreground"
                                title={`Ver ${arq.nome}`}
                              >
                                <Paperclip className="h-3.5 w-3.5 text-primary" />
                                <span className="max-w-[130px] truncate">{arq.nome}</span>
                                <span className="text-[11px] font-semibold text-primary">Ver</span>
                              </Button>
                            ))
                          ) : (
                            <span className="text-muted-foreground/50 text-[11px] italic flex items-center gap-1">
                              <Paperclip className="h-3 w-3 opacity-40" />
                              Sem arquivos
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Lotes sem data de medição */}
              {lotesSemMedicao.length > 0 && (
                <div className="pt-2.5 border-t border-border/40 text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-muted-foreground/80">Sem data de medição:</span>
                  {lotesSemMedicao.map((l: any) => {
                    const tipoNome = TIPOS_LOTE_LABELS[l.tipo as TipoLote] || l.tipo;
                    return (
                      <span
                        key={l.id}
                        className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground text-[11px]"
                      >
                        {tipoNome}{l.descricao ? ` (${l.descricao})` : ''}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {lotes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center space-y-3">
              <Package className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Nenhum lote cadastrado nesta obra</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Cadastre os lotes de esquadrias (Contramarco, Apto modelo, Andar tipo, etc.) para iniciar o cronograma de medição e fabricação.
              </p>
              <Button size="sm" onClick={() => setModalNovoLote(true)} className="gap-1 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Criar primeiro lote
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {lotes.map((lote: any) => {
                const tipoLegivel = TIPOS_LOTE_LABELS[lote.tipo as keyof typeof TIPOS_LOTE_LABELS] || lote.tipo;
                const statusLegivel = STATUS_LOTE_LABELS[lote.status as keyof typeof STATUS_LOTE_LABELS] || lote.status;
                const entregas = (lote.entregas as Entrega[]) || [];
                const totalEntregas = entregas.length;
                const entregasFeitas = entregas.filter((e) => !!e.entregue_em).length;
                const pecasEntregues = entregas
                  .filter((e) => !!e.entregue_em)
                  .reduce((acc, e) => acc + (e.quantidade || 0), 0);
                const totalPecas = lote.quantidade != null
                  ? lote.quantidade
                  : entregas.reduce((acc, e) => acc + (e.quantidade || 0), 0);
                const resumoTexto = `${entregasFeitas} de ${totalEntregas} entregas feitas • ${pecasEntregues} de ${totalPecas} peças`;

                const isEntregue = lote.status === 'entregue' || !!lote.entregue_em;
                const entregasPendentes = entregas.filter((e) => !e.entregue_em);
                const proximaEntregaPendente = entregasPendentes[0];
                const dataCombinadaRef = proximaEntregaPendente?.previsao || null;
                const temDataCombinada = Boolean(dataCombinadaRef);

                // Cores do card, pela PRÓXIMA entrega pendente (data combinada):
                // - vermelho: data passou e não foi entregue.
                // - amarelo: faltam 7 dias ou menos.
                // - Se não houver data combinada: use o Prazo Prado só para a cor, e mostre "Sem data combinada" em cinza.
                const dataCorRef = temDataCombinada ? dataCombinadaRef : lote.previsao_entrega;
                const diasRestantes = !isEntregue && dataCorRef ? diasAteData(dataCorRef) : null;

                let cardCorClass = 'border-border bg-card';
                if (!isEntregue && diasRestantes !== null) {
                  if (diasRestantes < 0) {
                    cardCorClass = 'border-destructive/60 bg-destructive/[0.02] shadow-2xs';
                  } else if (diasRestantes <= 7) {
                    cardCorClass = 'border-amber-500/60 bg-amber-500/[0.02] shadow-2xs';
                  }
                }

                // Linha 1: "<nª medição> · <Tipo> · <descrição>" + badge de status.
                const medicaoIdx = painelMedicoes.findIndex((item: any) => item.id === lote.id);
                const numMedicao = medicaoIdx >= 0 ? `${medicaoIdx + 1}ª medição` : null;
                const tituloLote = [numMedicao, tipoLegivel, lote.descricao].filter(Boolean).join(' · ');

                // Linha 2: "Medido em dd/mm/aaaa" (ou "Medição prevista dd/mm/aaaa" ou "Sem medição") + quantidade.
                let textoMedicao = 'Sem medição';
                if (lote.medido_em) {
                  textoMedicao = `Medido em ${formatarData(lote.medido_em)}`;
                } else if (lote.previsao_medicao) {
                  textoMedicao = `Medição prevista ${formatarData(lote.previsao_medicao)}`;
                }
                const textoQtd = lote.quantidade != null ? ` • ${lote.quantidade} peças` : '';

                return (
                  <div
                    key={lote.id}
                    className={`rounded-xl border ${cardCorClass} p-4 sm:p-5 shadow-2xs space-y-3.5 transition-colors`}
                  >
                    {/* Linha 1: "<nª medição> · <Tipo> · <descrição>" + badge de status */}
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="font-extrabold text-base text-foreground truncate">
                        {tituloLote}
                      </span>
                      <Badge
                        variant={
                          lote.status === 'entregue'
                            ? 'default'
                            : lote.status === 'produzido'
                            ? 'secondary'
                            : 'outline'
                        }
                        className="text-xs font-bold shrink-0"
                      >
                        {statusLegivel}
                      </Badge>
                    </div>

                    {/* Linha 2: "Medido em dd/mm/aaaa" + quantidade */}
                    <div className="text-sm font-medium text-foreground">
                      {textoMedicao}{textoQtd}
                    </div>

                    {/* Linha 3: "Prazo Prado: dd/mm/aaaa (<prazo_dias> dias)" e férias */}
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <span>
                        Prazo Prado: {formatarData(lote.previsao_entrega)}
                        {lote.prazo_dias ? ` (${lote.prazo_dias} dias)` : ''}
                      </span>
                      {lote.acrescimo_ferias_dias > 0 && (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                          +{lote.acrescimo_ferias_dias} dias férias
                        </span>
                      )}
                      {!temDataCombinada && !isEntregue && (
                        <span className="text-muted-foreground/70 italic">
                          • Sem data combinada
                        </span>
                      )}
                    </div>

                    {/* Bloco Entregas */}
                    <div className="rounded-lg border border-border bg-accent/15 p-3.5 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Truck className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-bold text-xs uppercase tracking-wider text-foreground">
                            Entregas
                          </span>
                          {totalEntregas > 0 && (
                            <span className="text-xs text-muted-foreground font-medium">
                              • {resumoTexto}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => abrirImportarCronograma(lote)}
                            className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary"
                          >
                            <UploadCloud className="h-3.5 w-3.5" />
                            Importar cronograma
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => abrirNovaEntrega(lote)}
                            className="h-7 text-xs font-semibold gap-1"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Entrega
                          </Button>
                        </div>
                      </div>

                      {totalEntregas === 0 ? (
                        <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 text-center">
                          <p className="text-xs text-muted-foreground">
                            Nenhuma entrega combinada. Clique em + Entrega.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto rounded-md border border-border/70 bg-background/60">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="border-b border-border/60 bg-muted/40 text-[11px] font-semibold text-muted-foreground">
                                <th className="py-2 px-3">Entrega</th>
                                <th className="py-2 px-3">Quantidade</th>
                                <th className="py-2 px-3">Data combinada</th>
                                <th className="py-2 px-3">Entregue em</th>
                                <th className="py-2 px-3">Recebido por</th>
                                <th className="py-2 px-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                              {entregas.map((ent: Entrega) => {
                                const entEntregue = !!ent.entregue_em;
                                return (
                                  <tr key={ent.id} className="hover:bg-accent/15 transition-colors">
                                    <td className="py-2 px-3 font-semibold text-foreground whitespace-nowrap">
                                      <div className="flex items-center gap-1.5">
                                        <span>Entrega {ent.numero}</span>
                                        {entEntregue ? (
                                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] h-4 px-1.5 font-bold">
                                            Entregue
                                          </Badge>
                                        ) : (
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                                            Pendente
                                          </Badge>
                                        )}
                                      </div>
                                      {ent.observacao && (
                                        <p
                                          className="text-[10px] text-muted-foreground italic truncate max-w-[180px] font-normal"
                                          title={ent.observacao}
                                        >
                                          {ent.observacao}
                                        </p>
                                      )}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      {ent.quantidade != null ? `${ent.quantidade} peças` : '—'}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap font-medium text-foreground">
                                      {ent.previsao ? formatarData(ent.previsao) : '—'}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      {ent.entregue_em ? formatarData(ent.entregue_em) : '—'}
                                    </td>
                                    <td className="py-2 px-3 whitespace-nowrap">
                                      {ent.responsavel_recebimento || '—'}
                                    </td>
                                    <td className="py-2 px-3 text-right whitespace-nowrap">
                                      <div className="flex items-center justify-end gap-1">
                                        {!entEntregue ? (
                                          <>
                                            <Button
                                              type="button"
                                              size="sm"
                                              onClick={() => abrirRegistrarEntrega(lote, ent)}
                                              className="h-6 px-2 text-[11px] font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                              title="Registrar entrega"
                                            >
                                              <Check className="h-3 w-3" />
                                              Registrar
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => abrirEditarEntrega(lote, ent)}
                                              className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                                              title="Editar entrega"
                                            >
                                              <Edit2 className="h-3 w-3" />
                                            </Button>
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setEntregaParaExcluir(ent)}
                                              className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10"
                                              title="Excluir entrega"
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => abrirEditarEntrega(lote, ent)}
                                            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                                            title="Editar entrega"
                                          >
                                            <Edit2 className="h-3 w-3" />
                                          </Button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Rodapé: Um botão de ação principal e o botão "Editar". Nada mais. */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <div>
                        {lote.status === 'aguardando_cadastro' && (
                          <Button
                            size="sm"
                            onClick={() => handleCadastroCompletoDireto(lote.id)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Cadastro completo
                          </Button>
                        )}

                        {lote.status === 'aguardando_medicao' && (
                          <Button
                            size="sm"
                            onClick={() => abrirAcaoEtapa('agendar_medicao', lote)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Agendar medição
                          </Button>
                        )}

                        {lote.status === 'medicao_agendada' && (
                          <Button
                            size="sm"
                            onClick={() => abrirAcaoEtapa('registrar_medicao', lote)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Registrar medição
                          </Button>
                        )}

                        {['medido', 'pcp', 'em_producao'].includes(lote.status) && (
                          <Button
                            size="sm"
                            onClick={() => abrirAcaoEtapa('atualizar_producao', lote)}
                            className="h-8 text-xs font-semibold gap-1.5"
                          >
                            <Factory className="h-3.5 w-3.5" />
                            Atualizar produção
                          </Button>
                        )}

                        {lote.status === 'produzido' && (
                          totalEntregas > 0 && proximaEntregaPendente ? (
                            <Button
                              size="sm"
                              onClick={() => abrirRegistrarEntrega(lote, proximaEntregaPendente)}
                              className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              Registrar entrega
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => abrirAcaoEtapa('registrar_entrega', lote)}
                              className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <Truck className="h-3.5 w-3.5" />
                              Registrar entrega
                            </Button>
                          )
                        )}

                        {lote.status === 'entregue' && (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4" />
                            Lote Entregue
                          </span>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => abrirEditarLote(lote)}
                        className="h-8 px-3 text-xs font-semibold gap-1.5"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        Editar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ABA: CHECKLIST */}
        <TabsContent value="checklist" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Checklist Operacional</h3>
                <p className="text-xs text-muted-foreground">
                  Itens mandatórios de acompanhamento da obra desde o fechamento até a revisão de 40 dias.
                </p>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-foreground">
                  {checklistConcluidos} de 9 concluídos
                </span>
                <div className="h-2 w-36 bg-border rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${(checklistConcluidos / 9) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              {checklist.map((item: any) => {
                const isEditandoEstaNota = editandoNotaItemId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`rounded-lg border p-3.5 transition-colors ${
                      item.feito ? 'bg-primary/5 border-primary/20' : 'bg-background border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id={`check-${item.id}`}
                          checked={item.feito}
                          onCheckedChange={() => {
                            if (!item.feito) {
                              setItemConcluindo(item);
                              setDataConclusaoChecklist(obterHojeSP());
                            } else {
                              handleToggleChecklist(item);
                            }
                          }}
                          className="mt-0.5"
                        />
                        <div>
                          <label
                            htmlFor={`check-${item.id}`}
                            className={`text-sm font-semibold cursor-pointer ${
                              item.feito ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {item.ordem}. {item.item}
                          </label>
                          {item.feito_em && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                              Concluído em: {formatarData(item.feito_em)}
                            </p>
                          )}
                          {item.nota && !isEditandoEstaNota && (
                            <p className="text-xs text-foreground bg-accent/40 rounded p-1.5 mt-1.5 font-medium">
                              Nota: {item.nota}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.item.toLowerCase().includes('treinamento de instalação') && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setModeloFollowup('treinamento_instalacao');
                              setModalNovoFollowup(true);
                            }}
                            className="h-7 px-2.5 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10"
                          >
                            <Calendar className="h-3 w-3" />
                            Agendar follow-up
                          </Button>
                        )}
                        {!isEditandoEstaNota && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditandoNotaItemId(item.id);
                              setTextoNotaItem(item.nota || '');
                            }}
                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          >
                            {item.nota ? 'Editar nota' : '+ Nota'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {isEditandoEstaNota && (
                      <div className="mt-3 pt-2 border-t border-border/60 flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Adicione uma observação sobre este item..."
                          value={textoNotaItem}
                          onChange={(e) => setTextoNotaItem(e.target.value)}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleSalvarNotaChecklist(item)}
                            className="h-8 text-xs font-semibold px-3"
                          >
                            Salvar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditandoNotaItemId(null)}
                            className="h-8 text-xs px-2"
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        {/* ABA: HISTÓRICO */}
        <TabsContent value="historico" className="space-y-4">
          {/* Follow-ups Pendentes da Obra */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Calendar className="h-4 w-4" />
                <span>Follow-ups Pendentes da Obra ({followups.length})</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setModeloFollowup('livre');
                  setModalNovoFollowup(true);
                }}
                className="gap-1.5 text-xs font-semibold h-7 px-2.5 bg-card hover:bg-accent"
              >
                <Plus className="h-3.5 w-3.5" />
                + Follow-up
              </Button>
            </div>

            {followups.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-1">
                Nenhum follow-up pendente para esta obra.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {followups.map((fup: any) => (
                  <div
                    key={fup.id}
                    className="rounded-lg border border-border bg-card p-3 text-xs space-y-2 shadow-2xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-foreground leading-tight">{fup.motivo}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {formatarData(fup.data)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Origem: {fup.origem} • Agendado para {formatarData(fup.data)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 pt-2 border-t border-border/60">
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleConcluirFollowupObra(fup.id)}
                        className="h-7 px-2 text-[11px] font-semibold flex-1 gap-1"
                      >
                        <Check className="h-3 w-3" />
                        Concluir
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFupRemarcando(fup)}
                        className="h-7 px-2 text-[11px] font-medium"
                      >
                        Remarcar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelarFollowupObra(fup.id)}
                        className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Registros de Histórico */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Histórico de Atividades</h3>
                <p className="text-xs text-muted-foreground">
                  Linha do tempo de notas, medições, atas e registros operacionais.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => abrirRegistrarNota()}
                className="gap-1.5 text-xs font-semibold h-8"
              >
                <Plus className="h-3.5 w-3.5" />
                Registrar nota
              </Button>
            </div>

            {registros.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-6">
                Nenhum registro no histórico da obra.
              </p>
            ) : (
              <div className="space-y-3">
                {registros.map((reg: any) => {
                  const loteRef = lotes.find((l: any) => l.id === reg.lote_id);
                  const loteTipo = loteRef ? TIPOS_LOTE_LABELS[loteRef.tipo as keyof typeof TIPOS_LOTE_LABELS] || loteRef.tipo : null;
                  const arquivosDoRegistro = arquivos.filter((a: any) => a.registro_id === reg.id);

                  return (
                    <div
                      key={reg.id}
                      className="rounded-lg border border-border bg-background p-3.5 text-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                            {reg.tipo}
                          </Badge>
                          {loteTipo && (
                            <Badge variant="outline" className="text-[10px]">
                              Lote: {loteTipo}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground font-medium">
                          {formatarDataHora(reg.data || reg.created_at)}
                        </span>
                      </div>

                      <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                        {reg.texto}
                      </p>

                      {/* Arquivos vinculados ao registro */}
                      {arquivosDoRegistro.length > 0 && (
                        <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
                          {arquivosDoRegistro.map((arq: any) => (
                            <div
                              key={arq.id}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 border border-border text-xs"
                            >
                              <Paperclip className="h-3 w-3 text-primary shrink-0" />
                              <span className="font-medium max-w-[200px] truncate">{arq.nome}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleVerArquivo(arq)}
                                className="h-6 px-1.5 text-[11px] text-primary hover:underline font-semibold ml-1"
                              >
                                Ver
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ABA: ARQUIVOS */}
        <TabsContent value="arquivos" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground">Documentos e Anexos</h3>
                <p className="text-xs text-muted-foreground">
                  Projetos, ordens de medição, laudos técnicos e atas da obra.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setModalEnviarArquivos(true)}
                className="gap-1.5 text-xs font-semibold h-8"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Enviar arquivo
              </Button>
            </div>

            {arquivos.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground italic">
                  Nenhum arquivo enviado para esta obra.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setModalEnviarArquivos(true)}
                  className="gap-1 text-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  Enviar primeiro arquivo
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {arquivos.map((arq: any) => {
                  const loteRef = lotes.find((l: any) => l.id === arq.lote_id);
                  const loteTipo = loteRef ? TIPOS_LOTE_LABELS[loteRef.tipo as keyof typeof TIPOS_LOTE_LABELS] || loteRef.tipo : null;

                  return (
                    <div
                      key={arq.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground truncate">{arq.nome}</p>
                          {loteTipo && (
                            <Badge variant="outline" className="text-[10px]">
                              {loteTipo}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {arq.tamanho && (
                            <span>
                              {arq.tamanho < 1024 * 1024
                                ? `${(arq.tamanho / 1024).toFixed(1)} KB`
                                : `${(arq.tamanho / (1024 * 1024)).toFixed(1)} MB`}
                            </span>
                          )}
                          <span>Enviado em {formatarData(arq.created_at)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleVerArquivo(arq)}
                          className="h-8 text-xs font-semibold gap-1.5"
                        >
                          Ver
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setArquivoExcluindo(arq)}
                          className="h-8 text-xs font-semibold text-muted-foreground hover:text-destructive gap-1.5"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modais do Cabeçalho */}
      <DialogProblema
        open={modalProblema}
        onOpenChange={setModalProblema}
        obraId={obraId}
        onSuccess={() => refetch()}
      />

      <DialogFinalizarObra
        open={modalFinalizar}
        onOpenChange={setModalFinalizar}
        obraId={obraId}
        onSuccess={() => refetch()}
      />

      <DialogNotaObra
        open={modalNota}
        onOpenChange={setModalNota}
        obraId={obraId}
        lotes={lotes}
        loteIdInicial={notaLoteId}
        onSuccess={() => refetch()}
      />

      {/* Modal Editar Obra */}
      <DialogEditarObra
        open={modalEditarObra}
        onOpenChange={setModalEditarObra}
        obra={obra}
        onSuccess={() => refetch()}
      />

      {/* Modal Novo Follow-up da Obra */}
      <DialogNovoFollowupObra
        open={modalNovoFollowup}
        onOpenChange={setModalNovoFollowup}
        obraId={obraId}
        lotes={lotes}
        modeloInicial={modeloFollowup}
        onSuccess={() => refetch()}
      />

      {/* Modal Remarcar Follow-up */}
      {fupRemarcando && (
        <DialogRemarcar
          open={!!fupRemarcando}
          onOpenChange={(v) => {
            if (!v) setFupRemarcando(null);
          }}
          followupId={fupRemarcando.id}
          motivo={fupRemarcando.motivo}
          dataAtual={fupRemarcando.data}
          onSuccess={() => {
            setFupRemarcando(null);
            refetch();
          }}
        />
      )}

      {/* Diálogo de Data para Concluir Item do Checklist */}
      {itemConcluindo && (
        <Dialog
          open={!!itemConcluindo}
          onOpenChange={(v) => {
            if (!v) setItemConcluindo(null);
          }}
        >
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">Concluir item do checklist</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {itemConcluindo.item}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <label htmlFor="data-conclusao-chk" className="text-xs font-semibold text-foreground">
                Data de conclusão
              </label>
              <Input
                id="data-conclusao-chk"
                type="date"
                value={dataConclusaoChecklist}
                onChange={(e) => setDataConclusaoChecklist(e.target.value)}
                className="h-9"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setItemConcluindo(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirmarConclusaoChecklist}
                className="gap-1 font-semibold"
              >
                <Check className="h-3.5 w-3.5" />
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modais de Lotes */}
      <DialogNovoLote
        open={modalNovoLote}
        onOpenChange={setModalNovoLote}
        obraId={obraId}
        lotes={lotes}
        onSuccess={() => refetch()}
      />

      <DialogEditarLote
        open={modalEditarLote}
        onOpenChange={setModalEditarLote}
        lote={loteEditando}
        lotes={lotes}
        obraId={obraId}
        onSuccess={() => refetch()}
      />

      <DialogAcaoEtapaLote
        open={modalAcaoEtapa}
        onOpenChange={setModalAcaoEtapa}
        tipoAcao={tipoAcaoEtapa}
        lote={loteAcaoEtapa}
        lotes={lotes}
        obraId={obraId}
        onSuccess={() => refetch()}
      />

      {/* Modal de Enviar Arquivos */}
      <DialogEnviarArquivos
        open={modalEnviarArquivos}
        onOpenChange={setModalEnviarArquivos}
        obraId={obraId}
        lotes={lotes}
        onSuccess={() => refetch()}
      />

      {/* Confirmação de Exclusão de Arquivo (sem window.confirm) */}
      <AlertDialog
        open={!!arquivoExcluindo}
        onOpenChange={(open) => {
          if (!open) setArquivoExcluindo(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir arquivo permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo <strong>"{arquivoExcluindo?.nome}"</strong> será removido do armazenamento e da lista de documentos desta obra. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluirArquivo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir Arquivo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modais de Entregas Parciais */}
      <DialogFormEntrega
        open={modalFormEntrega}
        onOpenChange={setModalFormEntrega}
        obraId={obraId}
        lote={loteEntrega}
        entrega={entregaEditando}
        onSuccess={() => refetch()}
      />

      <DialogRegistrarEntregaParcial
        open={modalRegistrarEntrega}
        onOpenChange={setModalRegistrarEntrega}
        obraId={obraId}
        lote={loteEntrega}
        entrega={entregaRegistrando}
        onSuccess={() => refetch()}
      />

      <AlertDialog
        open={!!entregaParaExcluir}
        onOpenChange={(open) => {
          if (!open) setEntregaParaExcluir(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir entrega {entregaParaExcluir?.numero}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta entrega será excluída e as entregas posteriores serão renumeradas automaticamente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindoEntrega}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmarExcluirEntrega}
              disabled={excluindoEntrega}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluindoEntrega ? 'Excluindo...' : 'Excluir Entrega'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualizador de Arquivo Interno */}
      <VisualizadorArquivo
        open={!!arquivoVisualizando}
        onOpenChange={(open) => {
          if (!open) setArquivoVisualizando(null);
        }}
        arquivo={arquivoVisualizando}
      />

      {/* Modal Importar Cronograma Prado */}
      <DialogImportarCronograma
        open={modalImportarCronograma}
        onOpenChange={setModalImportarCronograma}
        obraId={obraId}
        lote={loteImportandoCronograma}
        onSuccess={() => refetch()}
      />
    </main>
  );
}
