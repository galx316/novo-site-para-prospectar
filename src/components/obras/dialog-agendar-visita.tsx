import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  criarFollowupObra,
  CATEGORIAS_VISITA_SERVICO,
  CATEGORIAS_VISITA_LABELS,
  TIPOS_LOTE_LABELS,
  type CategoriaFollowup,
  type TipoLote,
} from '@/lib/obras.functions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wrench, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DialogAgendarVisitaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes?: any[];
  onSuccess: () => void;
}

export function DialogAgendarVisita({
  open,
  onOpenChange,
  obraId,
  lotes = [],
  onSuccess,
}: DialogAgendarVisitaProps) {
  const [categoria, setCategoria] = useState<CategoriaFollowup>('visita_tecnica');
  const [data, setData] = useState(obterHojeSP());
  const [loteId, setLoteId] = useState<string>('nenhum');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executarCriarFollowup = useServerFn(criarFollowupObra);

  useEffect(() => {
    if (open) {
      setCategoria('visita_tecnica');
      setData(obterHojeSP());
      setLoteId('nenhum');
      setDescricao('');
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!data) {
      toast.error('Informe a data do agendamento.');
      return;
    }

    try {
      setSalvando(true);
      const tipoRotulo = CATEGORIAS_VISITA_LABELS[categoria] || categoria;
      const motivoFinal = descricao.trim() ? `${tipoRotulo}: ${descricao.trim()}` : tipoRotulo;

      await executarCriarFollowup({
        data: {
          obraId,
          loteId: loteId && loteId !== 'nenhum' ? loteId : undefined,
          data,
          motivo: motivoFinal,
          categoria,
        },
      });

      toast.success(`${tipoRotulo} agendada com sucesso!`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar visita/serviço.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Wrench className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Visitas e Serviços</span>
          </div>
          <DialogTitle className="text-xl font-bold">Agendar Visita ou Serviço</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Agende vistorias técnicas, regulagens de esquadrias ou treinamentos na obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Tipo de serviço */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Tipo de Serviço *</label>
            <Select
              value={categoria}
              onValueChange={(v) => setCategoria(v as CategoriaFollowup)}
              disabled={salvando}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIAS_VISITA_SERVICO.map((cat) => (
                  <SelectItem key={cat.valor} value={cat.valor}>
                    {cat.rotulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data */}
          <div className="space-y-1.5">
            <label htmlFor="visita-data" className="text-xs font-semibold text-foreground">
              Data do Agendamento *
            </label>
            <Input
              id="visita-data"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              disabled={salvando}
              className="h-10"
              required
            />
          </div>

          {/* Lote (opcional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Lote Relacionado (opcional)</label>
            <Select value={loteId} onValueChange={setLoteId} disabled={salvando}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Nenhum lote específico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum lote específico</SelectItem>
                {lotes.map((l: any) => {
                  const tipoNome = TIPOS_LOTE_LABELS[l.tipo as TipoLote] || l.tipo;
                  const label = `${tipoNome}${l.descricao ? ` (${l.descricao})` : ''}`;
                  return (
                    <SelectItem key={l.id} value={l.id}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <label htmlFor="visita-desc" className="text-xs font-semibold text-foreground">
              Descrição do Serviço (opcional)
            </label>
            <Input
              id="visita-desc"
              placeholder="Ex.: Regular roldanas e vedações da porta da varanda"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
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
            <Button type="submit" disabled={salvando} className="gap-1.5">
              {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar agendamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
