import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  editarLote,
  excluirLote,
  criarFollowupObra,
  registrarNotaObra,
  registrarArquivo,
  TIPOS_LOTE_LABELS,
  STATUS_LOTE_LABELS,
  type TipoLote,
} from '@/lib/obras.functions';
import { obterHojeSP, adicionarDiasSP, formatarData } from '@/lib/date-utils';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit2, Loader2, Trash2, Bell } from 'lucide-react';
import { toast } from 'sonner';
import { CampoAnexosMedicao, uploadArquivosMedicao } from '@/components/obras/campo-anexos-medicao';

type StatusLote = Database['public']['Enums']['status_lote'];

const TIPOS_LOTE_OPCOES: { valor: TipoLote; rotulo: string }[] = [
  { valor: 'contramarco', rotulo: 'Contramarco' },
  { valor: 'apto_modelo', rotulo: 'Apto modelo' },
  { valor: 'andar_tipo', rotulo: 'Andar tipo' },
  { valor: 'area_comum', rotulo: 'Área comum' },
  { valor: 'especiais', rotulo: 'Especiais' },
  { valor: 'reposicao', rotulo: 'Reposição' },
];

interface DialogEditarLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: any | null;
  lotes?: any[];
  obraId: string;
  onSuccess: () => void;
}

function calcularNumeroMedicao(todosLotes: any[] = [], targetLoteId?: string): number {
  const medidos = todosLotes
    .filter((l) => !!l.medido_em)
    .sort((a, b) => String(a.medido_em).localeCompare(String(b.medido_em)));
  const previstos = todosLotes
    .filter((l) => !l.medido_em && !!l.previsao_medicao)
    .sort((a, b) => String(a.previsao_medicao).localeCompare(String(b.previsao_medicao)));
  const todos = [...medidos, ...previstos];
  if (!targetLoteId) return todos.length + 1;
  const idx = todos.findIndex((l) => l.id === targetLoteId);
  return idx >= 0 ? idx + 1 : todos.length + 1;
}

export function DialogEditarLote({
  open,
  onOpenChange,
  lote,
  lotes = [],
  obraId,
  onSuccess,
}: DialogEditarLoteProps) {
  const [tipo, setTipo] = useState<TipoLote>('contramarco');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [cadastroCompleto, setCadastroCompleto] = useState(false);
  const [previsaoMedicao, setPrevisaoMedicao] = useState('');
  const [medidoEm, setMedidoEm] = useState('');
  const [status, setStatus] = useState<string>('manter');
  const [dataConfirmada, setDataConfirmada] = useState('');
  const [recebimentoConfirmado, setRecebimentoConfirmado] = useState(false);
  const [responsavelRecebimento, setResponsavelRecebimento] = useState('');
  const [entregueEm, setEntregueEm] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Lembrete ao agendar / alterar previsão de medição
  const [criarLembrete, setCriarLembrete] = useState(true);
  const [dataLembrete, setDataLembrete] = useState('');
  const [motivoLembrete, setMotivoLembrete] = useState('');

  // Anexos da medição
  const [arquivosMedicao, setArquivosMedicao] = useState<File[]>([]);

  const executarEditarLote = useServerFn(editarLote);
  const executarExcluirLote = useServerFn(excluirLote);
  const executarCriarFollowup = useServerFn(criarFollowupObra);
  const executarRegistrarNota = useServerFn(registrarNotaObra);
  const executarRegistrarArquivo = useServerFn(registrarArquivo);

  const tipoLegivel = lote ? (TIPOS_LOTE_LABELS[tipo] || tipo) : '';

  function atualizarSugestaoLembrete(prevData: string) {
    if (!prevData || !lote) return;
    const hoje = obterHojeSP();
    let d = adicionarDiasSP(-3, prevData);
    if (d < hoje) d = hoje;
    setDataLembrete(d);

    const numMed = calcularNumeroMedicao(lotes, lote.id);
    const ddmm = formatarData(prevData).slice(0, 5);
    const tipoDesc = `${TIPOS_LOTE_LABELS[tipo] || tipo}${descricao ? ` ${descricao}` : ''}`;
    setMotivoLembrete(`Confirmar com a obra a ${numMed}ª medição (${tipoDesc}) prevista para ${ddmm}`);
  }

  useEffect(() => {
    if (lote && open) {
      setTipo(lote.tipo || 'contramarco');
      setDescricao(lote.descricao || '');
      setQuantidade(lote.quantidade ? String(lote.quantidade) : '');
      setCadastroCompleto(!!lote.cadastro_completo);
      const prev = lote.previsao_medicao ? lote.previsao_medicao.slice(0, 10) : '';
      setPrevisaoMedicao(prev);
      setMedidoEm(lote.medido_em ? lote.medido_em.slice(0, 10) : '');
      setStatus(lote.status || 'aguardando_cadastro');
      setDataConfirmada(lote.data_confirmada ? lote.data_confirmada.slice(0, 10) : '');
      setRecebimentoConfirmado(!!lote.recebimento_confirmado);
      setResponsavelRecebimento(lote.responsavel_recebimento || '');
      setEntregueEm(lote.entregue_em ? lote.entregue_em.slice(0, 10) : '');
      setConfirmarExcluir(false);
      setArquivosMedicao([]);

      if (prev) {
        setCriarLembrete(true);
        atualizarSugestaoLembrete(prev);
      } else {
        setCriarLembrete(false);
      }
    }
  }, [lote, open]);

  if (!lote) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (medidoEm && !cadastroCompleto) {
      toast.error('Complete o cadastro do lote antes da medição.');
      return;
    }

    const temEntregasParciais = Array.isArray(lote.entregas) && lote.entregas.length > 0;

    if (!temEntregasParciais && entregueEm && !medidoEm) {
      toast.error('Não é possível registrar entrega sem o lote ter sido medido.');
      return;
    }

    try {
      setSalvando(true);
      const qtdNum = quantidade ? parseInt(quantidade, 10) : null;

      const payload: any = {
        loteId: lote.id,
        obraId,
        tipo,
        descricao: descricao.trim() || null,
        quantidade: isNaN(qtdNum as number) ? null : qtdNum,
        cadastro_completo: cadastroCompleto,
        previsao_medicao: previsaoMedicao || null,
        medido_em: medidoEm || null,
      };

      if (!temEntregasParciais) {
        payload.data_confirmada = dataConfirmada || null;
        payload.recebimento_confirmado = recebimentoConfirmado;
        payload.responsavel_recebimento = responsavelRecebimento.trim() || null;
        payload.entregue_em = entregueEm || null;
      }

      // Só envia status se for um dos status manuais ('pcp', 'em_producao', 'produzido')
      if (['pcp', 'em_producao', 'produzido'].includes(status) && status !== lote.status) {
        if (!medidoEm) {
          toast.error('O lote precisa ter medição registrada para alterar status de produção.');
          setSalvando(false);
          return;
        }
        payload.status = status as StatusLote;
      }

      // 1. Atualizar lote
      await executarEditarLote({ data: payload });

      // 2. Se lembrete foi solicitado e há previsão de medição
      if (criarLembrete && previsaoMedicao && dataLembrete && motivoLembrete.trim()) {
        try {
          await executarCriarFollowup({
            data: {
              obraId,
              loteId: lote.id,
              data: dataLembrete,
              motivo: motivoLembrete.trim(),
            },
          });
        } catch (fupErr: any) {
          toast.error(`Aviso: falha ao criar lembrete: ${fupErr.message}`);
        }
      }

      // 3. Se foram selecionados arquivos da medição para anexar
      if (arquivosMedicao.length > 0) {
        try {
          const descTexto = descricao.trim() ? ` ${descricao.trim()}` : '';
          const resNota = await executarRegistrarNota({
            data: {
              obraId,
              loteId: lote.id,
              tipo: 'medicao',
              texto: `Arquivos da medição: ${tipoLegivel}${descTexto}`,
              data: medidoEm || lote.medido_em || obterHojeSP(),
            },
          });

          const regId = resNota.registro?.id;
          await uploadArquivosMedicao({
            arquivos: arquivosMedicao,
            obraId,
            loteId: lote.id,
            registroId: regId,
            registrarArquivoFn: executarRegistrarArquivo,
          });
        } catch (arqErr: any) {
          toast.error(`Erro ao anexar arquivos da medição: ${arqErr.message}`);
        }
      }

      toast.success('Lote atualizado com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao editar lote.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirLote() {
    try {
      setExcluindo(true);
      await executarExcluirLote({
        data: {
          obraId,
          loteId: lote.id,
        },
      });

      toast.success(`Lote ${tipoLegivel} excluído com sucesso.`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir lote.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Edit2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Edição</span>
          </div>
          <DialogTitle className="text-xl font-bold">Editar Dados do Lote</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ajuste informações operacionais, medição e entrega deste lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Identificação */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-tipo-lote" className="text-xs font-semibold text-foreground">
                Tipo do Lote *
              </label>
              <Select
                value={tipo}
                onValueChange={(v) => {
                  setTipo(v as TipoLote);
                  if (previsaoMedicao) atualizarSugestaoLembrete(previsaoMedicao);
                }}
                disabled={salvando || excluindo}
              >
                <SelectTrigger id="edit-tipo-lote" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_LOTE_OPCOES.map((opt) => (
                    <SelectItem key={opt.valor} value={opt.valor}>
                      {opt.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label htmlFor="edit-descricao-lote" className="text-xs font-semibold text-foreground">
                  Descrição / Detalhe
                </label>
                <Input
                  id="edit-descricao-lote"
                  placeholder="Ex: Torre B, Apto 101, Guarita..."
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-qtd-lote" className="text-xs font-semibold text-foreground">
                  Quantidade (peças)
                </label>
                <Input
                  id="edit-qtd-lote"
                  type="number"
                  min="0"
                  placeholder="Ex: 50"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          {/* Cadastro Completo */}
          <div className="rounded-lg border border-border bg-accent/30 p-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-foreground">Cadastro Completo</p>
              <p className="text-[11px] text-muted-foreground">
                Obrigatório estar marcado para habilitar a medição do lote.
              </p>
            </div>
            <Checkbox
              id="edit-cad-completo"
              checked={cadastroCompleto}
              onCheckedChange={(checked) => setCadastroCompleto(!!checked)}
              disabled={salvando || excluindo}
            />
          </div>

          {/* Medição */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-prev-med" className="text-xs font-semibold text-foreground">
                  Previsão de Medição
                </label>
                <Input
                  id="edit-prev-med"
                  type="date"
                  value={previsaoMedicao}
                  onChange={(e) => {
                    setPrevisaoMedicao(e.target.value);
                    if (e.target.value) {
                      setCriarLembrete(true);
                      atualizarSugestaoLembrete(e.target.value);
                    }
                  }}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-med-em" className="text-xs font-semibold text-foreground">
                  Medido em (Data Efetiva)
                </label>
                <Input
                  id="edit-med-em"
                  type="date"
                  value={medidoEm}
                  onChange={(e) => setMedidoEm(e.target.value)}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>
            </div>

            {/* Caixa de Lembrete ao definir previsão de medição */}
            {previsaoMedicao && (
              <div className="rounded-lg border border-border bg-accent/20 p-3 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="edit-chk-lembrete"
                    checked={criarLembrete}
                    onCheckedChange={(c) => setCriarLembrete(!!c)}
                    disabled={salvando || excluindo}
                  />
                  <label
                    htmlFor="edit-chk-lembrete"
                    className="text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
                  >
                    <Bell className="h-3.5 w-3.5 text-primary" />
                    Criar lembrete de medição
                  </label>
                </div>

                {criarLembrete && (
                  <div className="space-y-2 pl-6 pt-1">
                    <div className="space-y-1">
                      <label htmlFor="edit-data-lembrete" className="text-[11px] font-medium text-muted-foreground">
                        Data do lembrete
                      </label>
                      <Input
                        id="edit-data-lembrete"
                        type="date"
                        value={dataLembrete}
                        onChange={(e) => setDataLembrete(e.target.value)}
                        disabled={salvando || excluindo}
                        className="h-8 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="edit-motivo-lembrete" className="text-[11px] font-medium text-muted-foreground">
                        Motivo do lembrete
                      </label>
                      <Input
                        id="edit-motivo-lembrete"
                        value={motivoLembrete}
                        onChange={(e) => setMotivoLembrete(e.target.value)}
                        disabled={salvando || excluindo}
                        placeholder="Motivo do follow-up"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Anexar arquivos da medição */}
            <CampoAnexosMedicao
              arquivos={arquivosMedicao}
              onChange={setArquivosMedicao}
              disabled={salvando || excluindo}
            />
          </div>

          {/* Status Manual de Produção */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Status de Produção (após medição)
            </label>
            <Select value={status} onValueChange={setStatus} disabled={salvando || excluindo}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={lote.status}>
                  Manter atual ({STATUS_LOTE_LABELS[lote.status as StatusLote] || lote.status})
                </SelectItem>
                <SelectItem value="pcp">PCP</SelectItem>
                <SelectItem value="em_producao">Em produção</SelectItem>
                <SelectItem value="produzido">Produzido</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Status manual só aceita PCP, Em produção ou Produzido com medição registrada.
            </p>
          </div>

          {/* Entrega */}
          {Array.isArray(lote.entregas) && lote.entregas.length > 0 ? (
            <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">Entregas Parciais Ativas</p>
              Datas de entrega controladas pelas entregas abaixo.
            </div>
          ) : (
            <div className="space-y-3 pt-1 border-t border-border/60">
              <p className="text-xs font-bold text-foreground">Entrega do Lote</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="edit-data-conf" className="text-xs font-semibold text-foreground">
                    Data Confirmada de Entrega
                  </label>
                  <Input
                    id="edit-data-conf"
                    type="date"
                    value={dataConfirmada}
                    onChange={(e) => setDataConfirmada(e.target.value)}
                    disabled={salvando || excluindo}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="edit-entregue-em" className="text-xs font-semibold text-foreground">
                    Entregue em (Data Efetiva)
                  </label>
                  <Input
                    id="edit-entregue-em"
                    type="date"
                    value={entregueEm}
                    onChange={(e) => setEntregueEm(e.target.value)}
                    disabled={salvando || excluindo}
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-resp-receb" className="text-xs font-semibold text-foreground">
                  Responsável pelo Recebimento
                </label>
                <Input
                  id="edit-resp-receb"
                  placeholder="Ex: Engenheiro Mário"
                  value={responsavelRecebimento}
                  onChange={(e) => setResponsavelRecebimento(e.target.value)}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="edit-rec-conf"
                  checked={recebimentoConfirmado}
                  onCheckedChange={(checked) => setRecebimentoConfirmado(!!checked)}
                  disabled={salvando || excluindo}
                />
                <label
                  htmlFor="edit-rec-conf"
                  className="text-xs font-medium text-foreground cursor-pointer"
                >
                  Recebimento confirmado pela obra
                </label>
              </div>
            </div>
          )}

          {/* Confirmação de exclusão */}
          {confirmarExcluir && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 space-y-2">
              <p className="text-xs font-bold text-destructive">
                Deseja realmente excluir este lote?
              </p>
              <p className="text-[11px] text-muted-foreground">
                Todas as entregas parciais associadas também serão removidas. Esta ação não pode ser desfeita.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={excluindo}
                  onClick={() => setConfirmarExcluir(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={excluindo}
                  onClick={handleExcluirLote}
                  className="gap-1.5 font-semibold"
                >
                  {excluindo ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-3.5 w-3.5" />
                      Confirmar exclusão
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 border-t border-border/60">
            <div>
              {!confirmarExcluir && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={salvando || excluindo}
                  onClick={() => setConfirmarExcluir(true)}
                  className="w-full sm:w-auto gap-1.5 font-semibold"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir lote
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={salvando || excluindo}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={salvando || excluindo}
                className="gap-2 font-semibold"
              >
                {salvando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
