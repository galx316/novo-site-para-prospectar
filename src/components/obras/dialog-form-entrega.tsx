import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { criarEntrega, editarEntrega, type Entrega } from '@/lib/obras.functions';
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
import { Textarea } from '@/components/ui/textarea';
import { Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogFormEntregaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lote: any | null;
  entrega: Entrega | null;
  onSuccess: () => void;
}

export function DialogFormEntrega({
  open,
  onOpenChange,
  obraId,
  lote,
  entrega,
  onSuccess,
}: DialogFormEntregaProps) {
  const [quantidade, setQuantidade] = useState<string>('');
  const [previsao, setPrevisao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executarCriarEntrega = useServerFn(criarEntrega);
  const executarEditarEntrega = useServerFn(editarEntrega);

  const isEdicao = !!entrega;

  useEffect(() => {
    if (entrega) {
      setQuantidade(entrega.quantidade != null ? String(entrega.quantidade) : '');
      setPrevisao(entrega.previsao ? entrega.previsao.slice(0, 10) : '');
      setObservacao(entrega.observacao || '');
    } else {
      setQuantidade('');
      setPrevisao('');
      setObservacao('');
    }
  }, [entrega, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lote) return;

    try {
      setSalvando(true);
      const qtdNum = quantidade ? parseInt(quantidade, 10) : null;

      if (isEdicao && entrega) {
        await executarEditarEntrega({
          data: {
            obraId,
            entregaId: entrega.id,
            quantidade: isNaN(qtdNum as number) ? null : qtdNum,
            previsao: previsao || null,
            data_confirmada: null,
            observacao: observacao.trim() || null,
          },
        });
        toast.success(`Entrega ${entrega.numero} atualizada com sucesso.`);
      } else {
        await executarCriarEntrega({
          data: {
            obraId,
            loteId: lote.id,
            quantidade: isNaN(qtdNum as number) ? null : qtdNum,
            previsao: previsao || null,
            data_confirmada: null,
            observacao: observacao.trim() || null,
          },
        });
        toast.success('Entrega planejada com sucesso.');
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar entrega.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Package className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {isEdicao ? `Editar Entrega ${entrega?.numero}` : 'Nova Entrega'}
            </span>
          </div>
          <DialogTitle className="text-xl font-bold">
            {isEdicao ? `Entrega ${entrega?.numero}` : 'Combinar Entrega'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Defina a quantidade de peças e a data combinada com a obra para esta entrega.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Quantidade (opcional) */}
          <div className="space-y-1.5">
            <label htmlFor="ent-qtd" className="text-xs font-semibold text-foreground">
              Quantidade de Peças (opcional)
            </label>
            <Input
              id="ent-qtd"
              type="number"
              min="0"
              placeholder={lote?.quantidade ? `Total do lote: ${lote.quantidade} peças` : 'Ex: 50'}
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              disabled={salvando}
              className="h-9"
            />
          </div>

          {/* Data combinada */}
          <div className="space-y-1.5">
            <label htmlFor="ent-prev" className="text-xs font-semibold text-foreground">
              Data Combinada
            </label>
            <Input
              id="ent-prev"
              type="date"
              value={previsao}
              onChange={(e) => setPrevisao(e.target.value)}
              disabled={salvando}
              className="h-9"
            />
            <p className="text-[11px] text-muted-foreground">
              Data de entrega alinhada diretamente com a obra.
            </p>
          </div>

          {/* Observação (opcional) */}
          <div className="space-y-1.5">
            <label htmlFor="ent-obs" className="text-xs font-semibold text-foreground">
              Observação (opcional)
            </label>
            <Textarea
              id="ent-obs"
              placeholder="Ex: Entrega dos caixilhos da Torre A"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              disabled={salvando}
              rows={2}
              className="resize-none text-xs"
            />
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
              ) : isEdicao ? (
                'Salvar Alterações'
              ) : (
                'Criar Entrega'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
