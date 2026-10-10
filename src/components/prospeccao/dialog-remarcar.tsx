import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { remarcarFollowup } from '@/lib/prospeccao.functions';
import { adicionarDiasSP, formatarData, obterHojeSP } from '@/lib/date-utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon, Check } from 'lucide-react';
import { toast } from 'sonner';

interface DialogRemarcarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followupId?: string;
  motivo?: string;
  dataAtual?: string;
  atalhosDias?: number[];
  onSuccess: () => void;
}

export function DialogRemarcar({
  open,
  onOpenChange,
  followupId,
  motivo,
  dataAtual,
  atalhosDias = [3, 7, 15, 30],
  onSuccess,
}: DialogRemarcarProps) {
  const [novaData, setNovaData] = useState<string>('');
  const [modoEscolherData, setModoEscolherData] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const executarRemarcar = useServerFn(remarcarFollowup);

  useEffect(() => {
    if (open) {
      setNovaData(adicionarDiasSP(atalhosDias[0] || 7));
      setModoEscolherData(false);
    }
  }, [open, atalhosDias]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!followupId) {
      toast.error('Nenhum follow-up selecionado.');
      return;
    }
    if (!novaData) {
      toast.error('Selecione uma data para remarcar.');
      return;
    }

    setCarregando(true);
    try {
      await executarRemarcar({
        data: {
          id: followupId,
          data: novaData,
        },
      });

      toast.success('Follow-up remarcado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao remarcar follow-up.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Remarcar Follow-up</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {motivo && <span className="font-medium text-foreground">{motivo}</span>}
            {dataAtual && ` • Data atual: ${formatarData(dataAtual)}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nova Data do Follow-up
              </label>
              <span className="text-xs font-semibold text-primary">
                Remarcando para: {formatarData(novaData)}
              </span>
            </div>

            {/* Atalhos rápidos de dias */}
            <div className="flex flex-wrap gap-1.5">
              {atalhosDias.map((dias) => {
                const dataCalculada = adicionarDiasSP(dias);
                const ativo = novaData === dataCalculada && !modoEscolherData;
                return (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => {
                      setNovaData(dataCalculada);
                      setModoEscolherData(false);
                    }}
                    className={`flex-1 min-w-[70px] h-11 rounded-md text-xs font-semibold border transition-all ${
                      ativo
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    +{dias} dias
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setModoEscolherData(true)}
                className={`flex-1 min-w-[100px] h-11 rounded-md text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  modoEscolherData
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'border-border bg-card hover:bg-accent text-foreground'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Escolher data
              </button>
            </div>

            {/* Seletor manual */}
            {modoEscolherData && (
              <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                <input
                  type="date"
                  min={obterHojeSP()}
                  value={novaData}
                  onChange={(e) => setNovaData(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 w-full sm:w-auto"
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-12 w-full sm:w-auto font-medium gap-2"
              disabled={carregando}
            >
              {carregando ? (
                'Remarcando...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Nova Data
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
