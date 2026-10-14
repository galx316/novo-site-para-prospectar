import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { editarEntrega, type Entrega } from '@/lib/obras.functions';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Truck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogRegistrarEntregaParcialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lote: any | null;
  entrega: Entrega | null;
  onSuccess: () => void;
}

export function DialogRegistrarEntregaParcial({
  open,
  onOpenChange,
  obraId,
  lote,
  entrega,
  onSuccess,
}: DialogRegistrarEntregaParcialProps) {
  const [dataEntrega, setDataEntrega] = useState('');
  const [responsavelRecebimento, setResponsavelRecebimento] = useState('');
  const [recebimentoConfirmado, setRecebimentoConfirmado] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const executarEditarEntrega = useServerFn(editarEntrega);

  useEffect(() => {
    if (open) {
      setDataEntrega(obterHojeSP());
      setResponsavelRecebimento('');
      setRecebimentoConfirmado(true);
    }
  }, [open, entrega]);

  if (!entrega) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entrega) return;

    if (!dataEntrega) {
      toast.error('Informe a data da entrega.');
      return;
    }

    try {
      setSalvando(true);
      await executarEditarEntrega({
        data: {
          obraId,
          entregaId: entrega.id,
          entregue_em: dataEntrega,
          responsavel_recebimento: responsavelRecebimento.trim() || null,
          recebimento_confirmado: recebimentoConfirmado,
        },
      });

      toast.success(`Entrega ${entrega.numero} registrada com sucesso.`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar entrega.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
            <Truck className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Efetivar Entrega {entrega.numero}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            Registrar Entrega {entrega.numero}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {entrega.quantidade != null
              ? `Confirmando recebimento de remessa com ${entrega.quantidade} peças.`
              : 'Confirmando recebimento da remessa do lote.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="reg-data-ent" className="text-xs font-semibold text-foreground">
              Data da Entrega *
            </label>
            <Input
              id="reg-data-ent"
              type="date"
              value={dataEntrega}
              onChange={(e) => setDataEntrega(e.target.value)}
              disabled={salvando}
              className="h-9"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-resp" className="text-xs font-semibold text-foreground">
              Responsável pelo Recebimento
            </label>
            <Input
              id="reg-resp"
              placeholder="Ex: Engenheiro Carlos / Encarregado Silva"
              value={responsavelRecebimento}
              onChange={(e) => setResponsavelRecebimento(e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="reg-rec-conf"
              checked={recebimentoConfirmado}
              onCheckedChange={(checked) => setRecebimentoConfirmado(!!checked)}
              disabled={salvando}
            />
            <label htmlFor="reg-rec-conf" className="text-xs font-semibold text-foreground cursor-pointer">
              Recebimento confirmado
            </label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t border-border/60">
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
              disabled={salvando}
              className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Confirmar Entrega'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
