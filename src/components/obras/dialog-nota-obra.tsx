import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { registrarNotaObra, TIPOS_LOTE_LABELS } from '@/lib/obras.functions';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];

interface DialogNotaObraProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  obraId: string;
  lotes: any[];
  loteIdInicial?: string | null;
  onSuccess: () => void;
}

const TIPOS_REGISTRO_OBRA: { valor: TipoRegistro; rotulo: string }[] = [
  { valor: 'nota', rotulo: 'Nota Interna' },
  { valor: 'ata', rotulo: 'Ata de Reunião' },
  { valor: 'cronograma', rotulo: 'Atualização de Cronograma' },
  { valor: 'medicao', rotulo: 'Medição / Conferência' },
  { valor: 'visita', rotulo: 'Visita à Obra' },
  { valor: 'ligacao', rotulo: 'Ligação Telefônica' },
  { valor: 'whatsapp', rotulo: 'Mensagem de WhatsApp' },
  { valor: 'email', rotulo: 'E-mail' },
  { valor: 'outro', rotulo: 'Outro' },
];

export function DialogNotaObra({
  open,
  onOpenChange,
  obraId,
  lotes,
  loteIdInicial,
  onSuccess,
}: DialogNotaObraProps) {
  const [tipo, setTipo] = useState<TipoRegistro>('nota');
  const [loteId, setLoteId] = useState<string>(loteIdInicial || 'nenhum');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const executarRegistrarNota = useServerFn(registrarNotaObra);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (!textoLimpo) {
      toast.error('Informe o conteúdo da nota.');
      return;
    }

    try {
      setSalvando(true);
      await executarRegistrarNota({
        data: {
          obraId,
          loteId: loteId !== 'nenhum' ? loteId : undefined,
          tipo,
          texto: textoLimpo,
        },
      });

      toast.success('Nota registrada com sucesso no histórico da obra.');
      setTexto('');
      setTipo('nota');
      setLoteId('nenhum');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao registrar nota.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Histórico</span>
          </div>
          <DialogTitle className="text-xl font-bold">Registrar nota na obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Adicione uma anotação, ata, ocorrência de medição ou contato operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo de Registro *</label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRegistro)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS_REGISTRO_OBRA.map((t) => (
                    <SelectItem key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Vincular a Lote</label>
              <Select value={loteId} onValueChange={setLoteId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Geral da obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Geral da obra (nenhum lote)</SelectItem>
                  {lotes.map((l) => {
                    const tipoLabel = TIPOS_LOTE_LABELS[l.tipo as keyof typeof TIPOS_LOTE_LABELS] || l.tipo;
                    return (
                      <SelectItem key={l.id} value={l.id}>
                        {tipoLabel} {l.descricao ? `(${l.descricao})` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="texto-nota" className="text-xs font-semibold text-foreground">
              Texto da Nota *
            </label>
            <Textarea
              id="texto-nota"
              placeholder="Digite os detalhes da nota ou registro..."
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
            <Button type="submit" disabled={salvando || !texto.trim()} className="gap-2 font-semibold">
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  Salvar Nota
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
