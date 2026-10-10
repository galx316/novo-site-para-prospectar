import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { buscarClientesRPC, mesclarClientes } from '@/lib/prospeccao.functions';
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
import { Search, Merge, AlertTriangle, Check, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { SeloPrado } from './selo-prado';

interface DialogMesclarClienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteAtualId: string;
  clienteAtualNome: string;
  onSuccess: () => void;
}

export function DialogMesclarCliente({
  open,
  onOpenChange,
  clienteAtualId,
  clienteAtualNome,
  onSuccess,
}: DialogMesclarClienteProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<any[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [selecionado, setSelecionado] = useState<any | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const executarBusca = useServerFn(buscarClientesRPC);
  const executarMesclagem = useServerFn(mesclarClientes);

  async function handleBuscar(e: React.FormEvent) {
    e.preventDefault();
    if (!busca.trim()) return;

    setBuscando(true);
    setSelecionado(null);
    setConfirmado(false);
    try {
      const res = await executarBusca({ data: { texto: busca.trim(), limite: 8 } });
      // Não incluir o próprio cliente atual
      const filtrados = (res || []).filter((c: any) => c.id !== clienteAtualId);
      setResultados(filtrados);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao buscar construtoras.');
    } finally {
      setBuscando(false);
    }
  }

  async function handleConfirmarMesclagem() {
    if (!selecionado) return;

    setCarregando(true);
    try {
      await executarMesclagem({
        data: {
          manterId: clienteAtualId,
          removerId: selecionado.id,
        },
      });

      toast.success(
        `Construtora "${selecionado.nome}" mesclada com sucesso em "${clienteAtualNome}"!`
      );
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao mesclar construtoras.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Merge className="h-5 w-5 text-primary" />
            Juntar com outra construtora (Mesclar)
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Incorpore um cadastro duplicado nesta ficha principal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Construtora que será mantida */}
          <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/10">
            <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Cadastro que será mantido (Principal):
            </p>
            <p className="font-semibold text-base text-foreground mt-0.5">{clienteAtualNome}</p>
          </div>

          {/* Busca de construtora secundária */}
          <form onSubmit={handleBuscar} className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Buscar construtora duplicada a ser incorporada
            </label>
            <div className="flex gap-2">
              <Input
                placeholder="Digite o nome da construtora duplicada..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-11 bg-card"
              />
              <Button type="submit" className="h-11 px-4 gap-1.5" disabled={buscando}>
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </div>
          </form>

          {/* Resultados da busca */}
          {resultados.length > 0 && !selecionado && (
            <div className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border">
              {resultados.map((c) => (
                <div
                  key={c.id}
                  className="p-3 flex items-center justify-between hover:bg-accent/60 transition-colors"
                >
                  <div>
                    <p className="font-semibold text-sm text-foreground">{c.nome}</p>
                    <SeloPrado
                      situacao={c.situacao_prado}
                      representante={c.representante_prado}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelecionado(c);
                      setConfirmado(false);
                    }}
                    className="h-8 text-xs font-semibold"
                  >
                    Selecionar
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Construtora selecionada e confirmação */}
          {selecionado && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 space-y-3 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    A construtora "{selecionado.nome}" será removida após a unificação.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todos os contatos, histórico de registros, oportunidades e follow-ups de "
                    {selecionado.nome}" serão transferidos para "{clienteAtualNome}". Esta ação não
                    pode ser desfeita.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-destructive/20">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelecionado(null)}
                  className="h-8 text-xs"
                >
                  Trocar construtora
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleConfirmarMesclagem}
                  disabled={carregando}
                  className="h-10 text-xs font-semibold gap-1.5"
                >
                  {carregando ? (
                    'Mesclando...'
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirmar e Mesclar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 w-full"
            disabled={carregando}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
