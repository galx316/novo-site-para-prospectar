import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  editarLote,
  excluirLote,
  TIPOS_LOTE_LABELS,
  STATUS_LOTE_LABELS,
  type TipoLote,
} from '@/lib/obras.functions';
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
import { Edit2, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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
  obraId: string;
  onSuccess: () => void;
}

export function DialogEditarLote({
  open,
  onOpenChange,
  lote,
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

  const executarEditarLote = useServerFn(editarLote);
  const executarExcluirLote = useServerFn(excluirLote);

  useEffect(() => {
    if (lote) {
      setTipo(lote.tipo || 'contramarco');
      setDescricao(lote.descricao || '');
      setQuantidade(lote.quantidade ? String(lote.quantidade) : '');
      setCadastroCompleto(!!lote.cadastro_completo);
      setPrevisaoMedicao(lote.previsao_medicao ? lote.previsao_medicao.slice(0, 10) : '');
      setMedidoEm(lote.medido_em ? lote.medido_em.slice(0, 10) : '');
      setStatus(lote.status || 'aguardando_cadastro');
      setDataConfirmada(lote.data_confirmada ? lote.data_confirmada.slice(0, 10) : '');
      setRecebimentoConfirmado(!!lote.recebimento_confirmado);
      setResponsavelRecebimento(lote.responsavel_recebimento || '');
      setEntregueEm(lote.entregue_em ? lote.entregue_em.slice(0, 10) : '');
      setConfirmarExcluir(false);
    }
  }, [lote, open]);

  if (!lote) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (medidoEm && !cadastroCompleto) {
      toast.error('Complete o cadastro do lote antes da medição.');
      return;
    }

    if (entregueEm && !medidoEm) {
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
        data_confirmada: dataConfirmada || null,
        recebimento_confirmado: recebimentoConfirmado,
        responsavel_recebimento: responsavelRecebimento.trim() || null,
        entregue_em: entregueEm || null,
      };

      // Só envia status se for um dos status manuais ('pcp', 'em_producao', 'produzido')
      if (['pcp', 'em_producao', 'produzido'].includes(status) && status !== lote.status) {
        if (!medidoEm) {
          toast.error('O lote precisa ter medição registrada para alterar status de produção.');
          setSalvando(false);
          return;
        }
        payload.status = status as StatusLote;
      }

      await executarEditarLote({ data: payload });

      toast.success('Lote atualizado com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar lote.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluirLote() {
    if (!lote) return;
    try {
      setExcluindo(true);
      await executarExcluirLote({
        data: {
          obraId,
          loteId: lote.id,
        },
      });

      toast.success('Lote excluído com sucesso.');
      setConfirmarExcluir(false);
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
            <span className="text-xs font-bold uppercase tracking-wider">Edição de Lote</span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Lote: {TIPOS_LOTE_LABELS[tipo] || lote.tipo}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ajuste o tipo, dados cadastrais, medições, produção ou confirmação de entrega do lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Dados gerais */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-tipo" className="text-xs font-semibold text-foreground">
                Tipo
              </label>
              <Select
                value={tipo}
                onValueChange={(val) => setTipo(val as TipoLote)}
                disabled={salvando || excluindo}
              >
                <SelectTrigger id="edit-tipo" className="h-9">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="edit-desc" className="text-xs font-semibold text-foreground">
                  Descrição
                </label>
                <Input
                  id="edit-desc"
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  disabled={salvando || excluindo}
                  className="h-9"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="edit-qtd" className="text-xs font-semibold text-foreground">
                  Quantidade
                </label>
                <Input
                  id="edit-qtd"
                  type="number"
                  min="0"
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
                Obrigatorio estar marcado para habilitar a medição do lote.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-prev-med" className="text-xs font-semibold text-foreground">
                Previsão de Medição
              </label>
              <Input
                id="edit-prev-med"
                type="date"
                value={previsaoMedicao}
                onChange={(e) => setPrevisaoMedicao(e.target.value)}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
            <div className="space-y-1.5">
              <label htmlFor="edit-resp-rec" className="text-xs font-semibold text-foreground">
                Responsável pelo Recebimento
              </label>
              <Input
                id="edit-resp-rec"
                placeholder="Ex: Engenheiro Carlos"
                value={responsavelRecebimento}
                onChange={(e) => setResponsavelRecebimento(e.target.value)}
                disabled={salvando || excluindo}
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id="edit-rec-conf"
                checked={recebimentoConfirmado}
                onCheckedChange={(checked) => setRecebimentoConfirmado(!!checked)}
                disabled={salvando || excluindo}
              />
              <label htmlFor="edit-rec-conf" className="text-xs font-semibold text-foreground cursor-pointer">
                Recebimento confirmado
              </label>
            </div>
          </div>

          {/* Confirmação de exclusão em tela */}
          {confirmarExcluir && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3.5 space-y-3 animate-in fade-in-50 duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-destructive">
                    Confirma a exclusão deste lote?
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Esta ação apagará permanentemente este lote, incluindo follow-ups e registros associados. Não é possível desfazer.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
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
