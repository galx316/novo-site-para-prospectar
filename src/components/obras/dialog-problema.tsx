import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { marcarProblema, resolverProblema } from '@/lib/obras.functions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogProblemaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  onSuccess: () => void;
}

export function DialogProblema({
  open,
  onOpenChange,
  obraId,
  onSuccess,
}: DialogProblemaProps) {
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executarMarcarProblema = useServerFn(marcarProblema);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (!textoLimpo) {
      toast.error('Descreva o problema ocorrido na obra.');
      return;
    }

    try {
      setSalvando(true);
      await executarMarcarProblema({
        data: {
          obraId,
          texto: textoLimpo,
        },
      });

      toast.success('Problema registrado na obra com sucesso.');
      setTexto('');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar problema.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive mb-1">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Atenção</span>
          </div>
          <DialogTitle className="text-xl font-bold">Problema na obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Descreva detalhadamente a ocorrência ou impedimento operacional. A obra será sinalizada com alerta ativo.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="texto-problema" className="text-xs font-semibold text-foreground">
              Descrição do Problema *
            </label>
            <Textarea
              id="texto-problema"
              placeholder="Ex: Medição impedida por atraso na alvenaria do 5º pavimento..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={salvando}
              rows={4}
              autoFocus
              className="resize-none"
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
              variant="destructive"
              disabled={salvando || !texto.trim()}
              className="gap-2 font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Registrar Problema
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
