import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { editarLote, TIPOS_LOTE_LABELS, STATUS_LOTE_LABELS } from '@/lib/obras.functions';
import { obterHojeSP } from '@/lib/date-utils';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  CheckCircle,
  Factory,
  Truck,
  Loader2,
  PackageCheck,
} from 'lucide-react';
import { toast } from 'sonner';

type StatusLote = Database['public']['Enums']['status_lote'];
export type AcaoEtapaTipo =
  | 'agendar_medicao'
  | 'registrar_medicao'
  | 'atualizar_producao'
  | 'confirmar_entrega'
  | 'registrar_entrega';

interface DialogAcaoEtapaLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoAcao: AcaoEtapaTipo | null;
  lote: any | null;
  obraId: string;
  onSuccess: () => void;
}

export function DialogAcaoEtapaLote({
  open,
  onOpenChange,
  tipoAcao,
  lote,
  obraId,
  onSuccess,
}: DialogAcaoEtapaLoteProps) {
  const [dataInput, setDataInput] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [statusProducao, setStatusProducao] = useState<StatusLote>('pcp');
  const [salvando, setSalvando] = useState(false);

  const executarEditarLote = useServerFn(editarLote);

  useEffect(() => {
    if (lote && open) {
      const hoje = obterHojeSP();
      if (tipoAcao === 'agendar_medicao') {
        setDataInput(lote.previsao_medicao ? lote.previsao_medicao.slice(0, 10) : hoje);
      } else if (tipoAcao === 'registrar_medicao') {
        setDataInput(lote.medido_em ? lote.medido_em.slice(0, 10) : hoje);
      } else if (tipoAcao === 'confirmar_entrega') {
        setDataInput(lote.data_confirmada ? lote.data_confirmada.slice(0, 10) : hoje);
      } else if (tipoAcao === 'atualizar_producao') {
        setStatusProducao(
          ['pcp', 'em_producao', 'produzido'].includes(lote.status)
            ? lote.status
            : 'pcp'
        );
      } else if (tipoAcao === 'registrar_entrega') {
        setDataInput(lote.entregue_em ? lote.entregue_em.slice(0, 10) : hoje);
        setResponsavel(lote.responsavel_recebimento || '');
      }
    }
  }, [lote, tipoAcao, open]);

  if (!lote || !tipoAcao) return null;

  const tipoLegivel = TIPOS_LOTE_LABELS[lote.tipo as keyof typeof TIPOS_LOTE_LABELS] || lote.tipo;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSalvando(true);
      const payload: any = {
        loteId: lote.id,
        obraId,
      };

      if (tipoAcao === 'agendar_medicao') {
        if (!dataInput) {
          toast.error('Informe a previsão de medição.');
          setSalvando(false);
          return;
        }
        payload.previsao_medicao = dataInput;
      } else if (tipoAcao === 'registrar_medicao') {
        if (!dataInput) {
          toast.error('Informe a data em que o lote foi medido.');
          setSalvando(false);
          return;
        }
        payload.medido_em = dataInput;
      } else if (tipoAcao === 'atualizar_producao') {
        payload.status = statusProducao;
      } else if (tipoAcao === 'confirmar_entrega') {
        if (!dataInput) {
          toast.error('Informe a data confirmada de entrega.');
          setSalvando(false);
          return;
        }
        payload.data_confirmada = dataInput;
      } else if (tipoAcao === 'registrar_entrega') {
        if (!dataInput) {
          toast.error('Informe a data em que o lote foi entregue.');
          setSalvando(false);
          return;
        }
        payload.entregue_em = dataInput;
        payload.recebimento_confirmado = true;
        if (responsavel.trim()) {
          payload.responsavel_recebimento = responsavel.trim();
        }
      }

      await executarEditarLote({ data: payload });

      toast.success('Etapa do lote atualizada com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar etapa do lote.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            {tipoAcao === 'agendar_medicao' && <Calendar className="h-5 w-5" />}
            {tipoAcao === 'registrar_medicao' && <CheckCircle className="h-5 w-5" />}
            {tipoAcao === 'atualizar_producao' && <Factory className="h-5 w-5" />}
            {tipoAcao === 'confirmar_entrega' && <Calendar className="h-5 w-5" />}
            {tipoAcao === 'registrar_entrega' && <Truck className="h-5 w-5" />}
            <span className="text-xs font-bold uppercase tracking-wider">Avançar Etapa</span>
          </div>

          <DialogTitle className="text-xl font-bold">
            {tipoAcao === 'agendar_medicao' && 'Agendar medição'}
            {tipoAcao === 'registrar_medicao' && 'Registrar medição'}
            {tipoAcao === 'atualizar_producao' && 'Atualizar produção'}
            {tipoAcao === 'confirmar_entrega' && 'Confirmar data de entrega'}
            {tipoAcao === 'registrar_entrega' && 'Registrar entrega do lote'}
          </DialogTitle>

          <DialogDescription className="text-sm text-muted-foreground">
            Lote: <strong className="text-foreground">{tipoLegivel}</strong>{' '}
            {lote.descricao ? `(${lote.descricao})` : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {tipoAcao === 'agendar_medicao' && (
            <div className="space-y-1.5">
              <label htmlFor="prev-med-input" className="text-xs font-semibold text-foreground">
                Data Prevista para Medição *
              </label>
              <Input
                id="prev-med-input"
                type="date"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                disabled={salvando}
                className="h-10"
                autoFocus
              />
            </div>
          )}

          {tipoAcao === 'registrar_medicao' && (
            <div className="space-y-1.5">
              <label htmlFor="med-em-input" className="text-xs font-semibold text-foreground">
                Data da Medição Efetiva *
              </label>
              <Input
                id="med-em-input"
                type="date"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                disabled={salvando}
                className="h-10"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Ao registrar a medição, os prazos de produção e entrega serão recalculados automaticamente.
              </p>
            </div>
          )}

          {tipoAcao === 'atualizar_producao' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Novo Status de Produção *
              </label>
              <Select
                value={statusProducao}
                onValueChange={(v) => setStatusProducao(v as StatusLote)}
                disabled={salvando}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pcp">PCP (Planejamento e Controle de Produção)</SelectItem>
                  <SelectItem value="em_producao">Em produção na fábrica</SelectItem>
                  <SelectItem value="produzido">Produzido (Pronto para entrega)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {tipoAcao === 'confirmar_entrega' && (
            <div className="space-y-1.5">
              <label htmlFor="conf-entrega-input" className="text-xs font-semibold text-foreground">
                Data Confirmada de Entrega *
              </label>
              <Input
                id="conf-entrega-input"
                type="date"
                value={dataInput}
                onChange={(e) => setDataInput(e.target.value)}
                disabled={salvando}
                className="h-10"
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground">
                Alinha a expectativa final com a equipe da obra.
              </p>
            </div>
          )}

          {tipoAcao === 'registrar_entrega' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="entregue-em-input" className="text-xs font-semibold text-foreground">
                  Data de Entrega Efetiva *
                </label>
                <Input
                  id="entregue-em-input"
                  type="date"
                  value={dataInput}
                  onChange={(e) => setDataInput(e.target.value)}
                  disabled={salvando}
                  className="h-10"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="resp-receb-input" className="text-xs font-semibold text-foreground">
                  Recebido por (Responsável na Obra)
                </label>
                <Input
                  id="resp-receb-input"
                  placeholder="Ex: Engenheiro Mário / Mestre de obras"
                  value={responsavel}
                  onChange={(e) => setResponsavel(e.target.value)}
                  disabled={salvando}
                  className="h-10"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirmar
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
