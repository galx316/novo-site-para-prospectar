import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { criarLote, TIPOS_LOTE_LABELS } from '@/lib/obras.functions';
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
import { Package, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type TipoLote = Database['public']['Enums']['tipo_lote'];

interface DialogNovoLoteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  onSuccess: () => void;
}

const TIPOS_LOTE_OPCOES: { valor: TipoLote; rotulo: string }[] = [
  { valor: 'contramarco', rotulo: 'Contramarco' },
  { valor: 'apto_modelo', rotulo: 'Apto modelo' },
  { valor: 'andar_tipo', rotulo: 'Andar tipo' },
  { valor: 'area_comum', rotulo: 'Área comum' },
  { valor: 'especiais', rotulo: 'Especiais' },
  { valor: 'reposicao', rotulo: 'Reposição' },
];

export function DialogNovoLote({
  open,
  onOpenChange,
  obraId,
  onSuccess,
}: DialogNovoLoteProps) {
  const [tipo, setTipo] = useState<TipoLote>('contramarco');
  const [descricao, setDescricao] = useState('');
  const [quantidade, setQuantidade] = useState<string>('');
  const [salvando, setSalvando] = useState(false);

  const executarCriarLote = useServerFn(criarLote);

  function resetForm() {
    setTipo('contramarco');
    setDescricao('');
    setQuantidade('');
    setSalvando(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo) {
      toast.error('Selecione o tipo do lote.');
      return;
    }

    try {
      setSalvando(true);
      const qtdNum = quantidade ? parseInt(quantidade, 10) : undefined;
      await executarCriarLote({
        data: {
          obraId,
          tipo,
          descricao: descricao.trim() || undefined,
          quantidade: isNaN(qtdNum as number) ? undefined : qtdNum,
        },
      });

      toast.success('Lote criado com sucesso.');
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar lote.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Package className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Novo Lote</span>
          </div>
          <DialogTitle className="text-xl font-bold">Cadastrar lote da obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            O prazo e cronograma serão configurados e acompanhados a partir da medição do lote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tipo de Lote *</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoLote)}>
              <SelectTrigger className="h-10">
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

          <div className="space-y-1.5">
            <label htmlFor="desc-lote" className="text-xs font-semibold text-foreground">
              Descrição / Identificação (opcional)
            </label>
            <Input
              id="desc-lote"
              placeholder="Ex: Torre A - 1º ao 10º pavimentos"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={salvando}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="qtd-lote" className="text-xs font-semibold text-foreground">
              Quantidade de Peças / Vãos (opcional)
            </label>
            <Input
              id="qtd-lote"
              type="number"
              min="1"
              placeholder="Ex: 40"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
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
            <Button type="submit" disabled={salvando} className="gap-2 font-semibold">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <Package className="h-4 w-4" />
                  Criar Lote
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
