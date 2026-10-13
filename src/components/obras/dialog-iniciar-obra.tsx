import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { iniciarGestaoObra } from '@/lib/obras.functions';
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
import { Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogIniciarObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oportunidadeId: string | null;
  clienteNome?: string;
}

export function DialogIniciarObra({
  open,
  onOpenChange,
  oportunidadeId,
  clienteNome,
}: DialogIniciarObraProps) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [dataFechamento, setDataFechamento] = useState(obterHojeSP());
  const [jaEmAndamento, setJaEmAndamento] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const executarIniciarGestao = useServerFn(iniciarGestaoObra);

  function resetForm() {
    setNome('');
    setCidade('');
    setDataFechamento(obterHojeSP());
    setJaEmAndamento(false);
    setSalvando(false);
  }

  useEffect(() => {
    if (open) {
      setDataFechamento(obterHojeSP());
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error('Informe o nome da obra.');
      return;
    }
    if (!oportunidadeId) {
      toast.error('Oportunidade não identificada.');
      return;
    }

    try {
      setSalvando(true);
      const res = await executarIniciarGestao({
        data: {
          oportunidadeId,
          nome: nomeLimpo,
          cidade: cidade.trim() || undefined,
          dataFechamento: dataFechamento || undefined,
          jaEmAndamento,
        },
      });

      toast.success('Gestão da obra iniciada com sucesso!');
      onOpenChange(false);
      resetForm();

      navigate({
        to: '/obras-prado/$obraId',
        params: { obraId: res.obraId },
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar gestão da obra.');
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
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Gestão Operacional</span>
          </div>
          <DialogTitle className="text-xl font-bold">Iniciar gestão da obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome ? (
              <>Criar obra para a construtora <strong className="text-foreground">{clienteNome}</strong>.</>
            ) : (
              'Informe o nome da obra para iniciar o acompanhamento operacional de lotes e medições.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label htmlFor="nome-obra" className="text-xs font-semibold text-foreground">
              Nome da Obra *
            </label>
            <Input
              id="nome-obra"
              placeholder="Ex: Edifício Bella Vista"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              autoFocus
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cidade-obra" className="text-xs font-semibold text-foreground">
              Cidade (opcional)
            </label>
            <Input
              id="cidade-obra"
              placeholder="Ex: Paulínia"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={salvando}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="data-fechamento" className="text-xs font-semibold text-foreground">
              Data de fechamento
            </label>
            <Input
              id="data-fechamento"
              type="date"
              value={dataFechamento}
              onChange={(e) => setDataFechamento(e.target.value)}
              disabled={salvando}
              className="h-10"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="ja-em-andamento"
              checked={jaEmAndamento}
              onCheckedChange={(c) => setJaEmAndamento(!!c)}
              disabled={salvando}
            />
            <label
              htmlFor="ja-em-andamento"
              className="text-xs font-medium text-foreground cursor-pointer"
            >
              Obra já em andamento (não criar as tarefas iniciais)
            </label>
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
            <Button type="submit" disabled={salvando || !nome.trim()} className="gap-2 font-semibold">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Iniciar Gestão
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
