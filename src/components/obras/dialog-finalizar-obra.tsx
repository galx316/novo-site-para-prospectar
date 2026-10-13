import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { finalizarObra } from '@/lib/obras.functions';
import { obterHojeSP } from '@/lib/date-utils';
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
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogFinalizarObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  onSuccess: () => void;
}

export function DialogFinalizarObra({
  open,
  onOpenChange,
  obraId,
  onSuccess,
}: DialogFinalizarObraProps) {
  const [data, setData] = useState(obterHojeSP());
  const [salvando, setSalvando] = useState(false);

  const executarFinalizarObra = useServerFn(finalizarObra);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) {
      toast.error('Informe a data de finalização da obra.');
      return;
    }

    try {
      setSalvando(true);
      await executarFinalizarObra({
        data: {
          obraId,
          data,
        },
      });

      toast.success('Obra marcada como finalizada com sucesso.');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao finalizar obra.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Conclusão</span>
          </div>
          <DialogTitle className="text-xl font-bold">Finalizar obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Ao finalizar a obra, o sistema agendará automaticamente o follow-up de revisão técnica de 40 dias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="data-finalizacao" className="text-xs font-semibold text-foreground">
              Data de Finalização *
            </label>
            <Input
              id="data-finalizacao"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={salvando}
              className="h-10"
            />
          </div>

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
              disabled={salvando || !data}
              className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar Finalização
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
