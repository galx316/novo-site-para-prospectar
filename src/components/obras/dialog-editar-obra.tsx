import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { editarObra } from '@/lib/obras.functions';
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
import { Edit2, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface DialogEditarObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obra: {
    id: string;
    nome: string;
    cidade?: string | null;
    data_fechamento?: string | null;
    observacoes?: string | null;
  };
  onSuccess: () => void;
}

export function DialogEditarObra({
  open,
  onOpenChange,
  obra,
  onSuccess,
}: DialogEditarObraProps) {
  const [nome, setNome] = useState(obra.nome || '');
  const [cidade, setCidade] = useState(obra.cidade || '');
  const [dataFechamento, setDataFechamento] = useState(obra.data_fechamento || '');
  const [observacoes, setObservacoes] = useState(obra.observacoes || '');
  const [salvando, setSalvando] = useState(false);

  const executarEditar = useServerFn(editarObra);

  useEffect(() => {
    if (open) {
      setNome(obra.nome || '');
      setCidade(obra.cidade || '');
      setDataFechamento(obra.data_fechamento || '');
      setObservacoes(obra.observacoes || '');
    }
  }, [open, obra]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error('Informe o nome da obra.');
      return;
    }

    try {
      setSalvando(true);
      await executarEditar({
        data: {
          obraId: obra.id,
          nome: nomeLimpo,
          cidade: cidade.trim() || undefined,
          dataFechamento: dataFechamento || undefined,
          observacoes: observacoes.trim() || undefined,
        },
      });

      toast.success('Dados da obra atualizados com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar dados da obra.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Edit2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Edição da Obra</span>
          </div>
          <DialogTitle className="text-xl font-bold">Editar dados da obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Altere as informações cadastrais e observações desta obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="edit-nome-obra" className="text-xs font-semibold text-foreground">
              Nome da Obra *
            </label>
            <Input
              id="edit-nome-obra"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              required
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="edit-cidade-obra" className="text-xs font-semibold text-foreground">
                Cidade (opcional)
              </label>
              <Input
                id="edit-cidade-obra"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={salvando}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-data-fechamento" className="text-xs font-semibold text-foreground">
                Data de Fechamento
              </label>
              <Input
                id="edit-data-fechamento"
                type="date"
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
                disabled={salvando}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-obs-obra" className="text-xs font-semibold text-foreground">
              Observações (opcional)
            </label>
            <Textarea
              id="edit-obs-obra"
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={salvando}
              className="resize-none text-xs"
              placeholder="Informações contratuais, detalhes dos blocos, etc."
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
              disabled={salvando || !nome.trim()}
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
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
