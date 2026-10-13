import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { criarFollowupObra, TIPOS_LOTE_LABELS } from '@/lib/obras.functions';
import { adicionarDiasSP, obterHojeSP, formatarData } from '@/lib/date-utils';
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
import { Calendar, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface LoteOpcao {
  id: string;
  tipo: string;
  descricao?: string | null;
}

interface DialogNovoFollowupObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes?: LoteOpcao[];
  onSuccess: () => void;
}

export function DialogNovoFollowupObra({
  open,
  onOpenChange,
  obraId,
  lotes = [],
  onSuccess,
}: DialogNovoFollowupObraProps) {
  const [data, setData] = useState(adicionarDiasSP(7));
  const [motivo, setMotivo] = useState('');
  const [loteId, setLoteId] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executarCriar = useServerFn(criarFollowupObra);

  useEffect(() => {
    if (open) {
      setData(adicionarDiasSP(7));
      setMotivo('');
      setLoteId('');
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const motivoLimpo = motivo.trim();
    if (!motivoLimpo) {
      toast.error('Informe o motivo do follow-up.');
      return;
    }
    if (!data) {
      toast.error('Informe a data do follow-up.');
      return;
    }

    try {
      setSalvando(true);
      await executarCriar({
        data: {
          obraId,
          loteId: loteId || undefined,
          data,
          motivo: motivoLimpo,
        },
      });

      toast.success('Follow-up da obra agendado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar follow-up.');
    } finally {
      setSalvando(false);
    }
  }

  const atalhosDias = [3, 7, 15, 30];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Calendar className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Acompanhamento</span>
          </div>
          <DialogTitle className="text-xl font-bold">Novo Follow-up da Obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Agende uma tarefa ou lembrete operacional para esta obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Data do follow-up com atalhos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="data-fup-obra" className="text-xs font-semibold text-foreground">
                Data do Follow-up *
              </label>
              <span className="text-xs text-primary font-medium">
                {data ? formatarData(data) : 'Selecione uma data'}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {atalhosDias.map((dias) => {
                const dataCalculada = adicionarDiasSP(dias);
                const ativo = data === dataCalculada;
                return (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => setData(dataCalculada)}
                    className={`flex-1 min-w-[65px] h-9 rounded-md text-xs font-semibold border transition-all ${
                      ativo
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    +{dias} dias
                  </button>
                );
              })}
            </div>

            <Input
              id="data-fup-obra"
              type="date"
              min={obterHojeSP()}
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={salvando}
              required
              className="h-10"
            />
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <label htmlFor="motivo-fup-obra" className="text-xs font-semibold text-foreground">
              Motivo do Follow-up *
            </label>
            <Input
              id="motivo-fup-obra"
              placeholder="Ex: Cobrar conferência dos vãos no bloco B"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              disabled={salvando}
              required
              className="h-10"
              autoFocus
            />
          </div>

          {/* Lote opcional */}
          {lotes.length > 0 && (
            <div className="space-y-1.5">
              <label htmlFor="lote-fup-obra" className="text-xs font-semibold text-foreground">
                Lote vinculado (opcional)
              </label>
              <select
                id="lote-fup-obra"
                value={loteId}
                onChange={(e) => setLoteId(e.target.value)}
                disabled={salvando}
                className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs font-medium"
              >
                <option value="">Geral da obra (sem lote específico)</option>
                {lotes.map((lote) => {
                  const tipoNome = TIPOS_LOTE_LABELS[lote.tipo as keyof typeof TIPOS_LOTE_LABELS] || lote.tipo;
                  return (
                    <option key={lote.id} value={lote.id}>
                      {tipoNome}{lote.descricao ? ` - ${lote.descricao}` : ''}
                    </option>
                  );
                })}
              </select>
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
            <Button
              type="submit"
              disabled={salvando || !motivo.trim() || !data}
              className="gap-2 font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Agendar Follow-up
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
