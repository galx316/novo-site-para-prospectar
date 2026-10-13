import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { cadastrarObraFechada } from '@/lib/obras.functions';
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
import { Building2, Loader2, AlertTriangle, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ContatoOpcao {
  id: string;
  nome: string;
  cargo?: string | null;
}

interface DialogCadastrarObraFechadaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome?: string;
  clienteSituacaoPrado?: string | null;
  clienteRepresentantePrado?: string | null;
  contatos?: ContatoOpcao[];
  onSuccess?: () => void;
}

export function DialogCadastrarObraFechada({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  clienteSituacaoPrado,
  clienteRepresentantePrado,
  contatos = [],
  onSuccess,
}: DialogCadastrarObraFechadaProps) {
  const navigate = useNavigate();
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [dataFechamento, setDataFechamento] = useState(obterHojeSP());
  const [contatoId, setContatoId] = useState<string>('');
  const [jaEmAndamento, setJaEmAndamento] = useState(true);
  const [confirmouPradoOutroRep, setConfirmouPradoOutroRep] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const executarCadastro = useServerFn(cadastrarObraFechada);

  const ehAtendidaOutroRep = clienteSituacaoPrado === 'atendida_outro_rep';

  function resetForm() {
    setNome('');
    setCidade('');
    setDataFechamento(obterHojeSP());
    setContatoId('');
    setJaEmAndamento(true);
    setConfirmouPradoOutroRep(false);
    setSalvando(false);
  }

  useEffect(() => {
    if (open) {
      setDataFechamento(obterHojeSP());
      setJaEmAndamento(true);
      setConfirmouPradoOutroRep(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const nomeLimpo = nome.trim();
    if (!nomeLimpo) {
      toast.error('Informe o nome da obra.');
      return;
    }

    if (ehAtendidaOutroRep && !confirmouPradoOutroRep) {
      toast.warning('Por favor confirme que está ciente sobre a representação da PRADO.');
      return;
    }

    try {
      setSalvando(true);
      const res = await executarCadastro({
        data: {
          clienteId,
          nome: nomeLimpo,
          cidade: cidade.trim() || undefined,
          dataFechamento: dataFechamento || undefined,
          contatoId: contatoId || undefined,
          jaEmAndamento,
        },
      });

      toast.success('Obra cadastrada com sucesso!');
      onOpenChange(false);
      resetForm();
      onSuccess?.();

      navigate({
        to: '/obras-prado/$obraId',
        params: { obraId: res.obraId },
      });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cadastrar obra fechada.');
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
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Building2 className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Gestão Operacional</span>
          </div>
          <DialogTitle className="text-xl font-bold">Cadastrar obra já fechada</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome ? (
              <>Cadastrar obra PRADO para a construtora <strong className="text-foreground">{clienteNome}</strong>.</>
            ) : (
              'Cadastrar obra PRADO fechada e iniciar o acompanhamento operacional.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Aviso se a construtora já for atendida por outro representante PRADO */}
          {ehAtendidaOutroRep && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive animate-in fade-in space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Atenção:</strong> Esta construtora já é atendida por outro representante PRADO (
                  {clienteRepresentantePrado || 'outro representante'}).
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1 border-t border-destructive/20">
                <Checkbox
                  id="confirmar-prado-obra-fechada"
                  checked={confirmouPradoOutroRep}
                  onCheckedChange={(c) => setConfirmouPradoOutroRep(!!c)}
                />
                <label
                  htmlFor="confirmar-prado-obra-fechada"
                  className="font-medium cursor-pointer text-foreground text-xs"
                >
                  Estou ciente e desejo prosseguir com o cadastro desta obra PRADO.
                </label>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="nome-obra-fechada" className="text-xs font-semibold text-foreground">
              Nome da Obra *
            </label>
            <Input
              id="nome-obra-fechada"
              placeholder="Ex: Reserva Imperial"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={salvando}
              autoFocus
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="cidade-obra-fechada" className="text-xs font-semibold text-foreground">
                Cidade (opcional)
              </label>
              <Input
                id="cidade-obra-fechada"
                placeholder="Ex: Campinas"
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={salvando}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="data-fechamento-obra" className="text-xs font-semibold text-foreground">
                Data de fechamento
              </label>
              <Input
                id="data-fechamento-obra"
                type="date"
                value={dataFechamento}
                onChange={(e) => setDataFechamento(e.target.value)}
                disabled={salvando}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contato-obra-fechada" className="text-xs font-semibold text-foreground">
              Contato vinculado (opcional)
            </label>
            <select
              id="contato-obra-fechada"
              value={contatoId}
              onChange={(e) => setContatoId(e.target.value)}
              disabled={salvando}
              className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs font-medium"
            >
              <option value="">Sem contato vinculado</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.cargo ? ` (${c.cargo})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Checkbox
              id="obra-ja-em-andamento"
              checked={jaEmAndamento}
              onCheckedChange={(c) => setJaEmAndamento(!!c)}
              disabled={salvando}
            />
            <label
              htmlFor="obra-ja-em-andamento"
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
            <Button
              type="submit"
              disabled={salvando || !nome.trim()}
              className="gap-2 font-semibold"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Cadastrar Obra
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
