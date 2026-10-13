import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { editarLote, TIPOS_LOTE_LABELS, STATUS_LOTE_LABELS } from '@/lib/obras.functions';
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
import { Edit2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

type StatusLote = Database['public']['Enums']['status_lote'];

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

  const executarEditarLote = useServerFn(editarLote);

  useEffect(() => {
    if (lote) {
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
    }
  }, [lote, open]);

  if (!lote) return null;

  const tipoLegivel = TIPOS_LOTE_LABELS[lote.tipo as keyof typeof TIPOS_LOTE_LABELS] || lote.tipo;

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Edit2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Edição de Lote</span>
          </div>
          <DialogTitle className="text-xl font-bold">Lote: {tipoLegivel}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ajuste os dados cadastrais, medições, produção ou confirmação de entrega do lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Dados gerais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-desc" className="text-xs font-semibold text-foreground">
                Descrição
              </label>
              <Input
                id="edit-desc"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                disabled={salvando}
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
                disabled={salvando}
                className="h-9"
              />
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
              disabled={salvando}
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
                disabled={salvando}
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
                disabled={salvando}
                className="h-9"
              />
            </div>
          </div>

          {/* Status Manual de Produção */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Status de Produção (após medição)
            </label>
            <Select value={status} onValueChange={setStatus} disabled={salvando}>
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
                disabled={salvando}
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
                disabled={salvando}
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
                disabled={salvando}
                className="h-9"
              />
            </div>

            <div className="flex items-center gap-2 pt-5">
              <Checkbox
                id="edit-rec-conf"
                checked={recebimentoConfirmado}
                onCheckedChange={(checked) => setRecebimentoConfirmado(!!checked)}
                disabled={salvando}
              />
              <label htmlFor="edit-rec-conf" className="text-xs font-semibold text-foreground cursor-pointer">
                Recebimento confirmado
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border/60">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="gap-2 font-semibold">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
