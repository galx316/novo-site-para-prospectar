import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatarData, obterHojeSP } from '@/lib/date-utils';
import {
  editarRegistro,
  excluirRegistro,
  editarFollowup,
  excluirFollowup,
} from '@/lib/prospeccao.functions';
import type { Database } from '@/integrations/supabase/types';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];

const OPCOES_TIPO_REGISTRO: Array<{ valor: TipoRegistro; label: string }> = [
  { valor: 'nota', label: 'Nota' },
  { valor: 'ligacao', label: 'Ligação' },
  { valor: 'visita', label: 'Visita' },
  { valor: 'email', label: 'E-mail' },
  { valor: 'whatsapp', label: 'WhatsApp' },
  { valor: 'outro', label: 'Outro' },
  { valor: 'ata', label: 'Ata de reunião' },
  { valor: 'cronograma', label: 'Cronograma' },
  { valor: 'medicao', label: 'Medição' },
  { valor: 'problema', label: 'Problema / Ocorrência' },
];

// ==========================================
// 1. DIALOG: EDITAR REGISTRO
// ==========================================
export interface DialogEditarRegistroProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: {
    id: string;
    tipo: TipoRegistro | string;
    texto?: string | null;
    data?: string | null;
    created_at?: string;
    direcao?: string | null;
  } | null;
  onSucesso: () => void;
}

export function DialogEditarRegistro({
  open,
  onOpenChange,
  registro,
  onSucesso,
}: DialogEditarRegistroProps) {
  const [tipo, setTipo] = useState<TipoRegistro>('nota');
  const [data, setData] = useState('');
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fnEditarRegistro = useServerFn(editarRegistro);

  useEffect(() => {
    if (registro && open) {
      setTipo((registro.tipo as TipoRegistro) || 'nota');
      const d = registro.data || registro.created_at || '';
      setData(d ? d.slice(0, 10) : obterHojeSP());
      setTexto(registro.texto || '');
    }
  }, [registro, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!registro) return;
    setSalvando(true);
    try {
      await fnEditarRegistro({
        data: {
          registroId: registro.id,
          tipo,
          data,
          texto,
        },
      });
      toast.success('Registro atualizado com sucesso!');
      onOpenChange(false);
      onSucesso();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar registro.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Edit className="h-4 w-4 text-primary" />
            Editar Registro do Histórico
          </DialogTitle>
          <DialogDescription className="text-xs">
            Altere o tipo, data ou texto da atividade registrada.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tipo-registro" className="text-xs font-semibold">
              Tipo de Registro
            </Label>
            <Select value={tipo} onValueChange={(val) => setTipo(val as TipoRegistro)}>
              <SelectTrigger id="tipo-registro" className="h-9 text-xs">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {OPCOES_TIPO_REGISTRO.map((op) => (
                  <SelectItem key={op.valor} value={op.valor} className="text-xs">
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data-registro" className="text-xs font-semibold">
              Data
            </Label>
            <Input
              id="data-registro"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="texto-registro" className="text-xs font-semibold">
              Texto / Observações
            </Label>
            <Textarea
              id="texto-registro"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              placeholder="Descreva a atividade ou registro..."
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={salvando} className="text-xs gap-1.5">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 2. DIALOG: EXCLUIR REGISTRO
// ==========================================
export interface DialogExcluirRegistroProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registro: {
    id: string;
    tipo?: string | null;
    direcao?: string | null;
    texto?: string | null;
    data?: string | null;
    created_at?: string;
  } | null;
  temAnexos?: boolean;
  onSucesso: () => void;
}

export function DialogExcluirRegistro({
  open,
  onOpenChange,
  registro,
  temAnexos,
  onSucesso,
}: DialogExcluirRegistroProps) {
  const [excluindo, setExcluindo] = useState(false);
  const fnExcluirRegistro = useServerFn(excluirRegistro);

  const ehEnvioResposta =
    registro &&
    (registro.tipo === 'whatsapp' || registro.tipo === 'email') &&
    (registro.direcao === 'enviado' || registro.direcao === 'recebido');

  async function handleExcluir() {
    if (!registro) return;
    setExcluindo(true);
    try {
      await fnExcluirRegistro({
        data: { registroId: registro.id },
      });
      toast.success('Registro excluído com sucesso!');
      onOpenChange(false);
      onSucesso();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir registro.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <Trash2 className="h-4 w-4" />
            Excluir Registro do Histórico
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tem certeza que deseja excluir este registro do histórico? Esta ação é irreversível.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {registro?.texto && (
            <div className="rounded-md border border-border bg-muted/40 p-2.5 max-h-24 overflow-y-auto italic text-muted-foreground whitespace-pre-wrap">
              "{registro.texto}"
            </div>
          )}

          {ehEnvioResposta && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Isso não desfaz o follow-up criado por esse envio/resposta. Ajuste o follow-up se precisar.
              </span>
            </div>
          )}

          {temAnexos && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-3 text-blue-800 dark:text-blue-300">
              Os anexos continuam na aba Arquivos.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleExcluir}
            disabled={excluindo}
            className="text-xs gap-1.5"
          >
            {excluindo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Excluir Registro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 3. DIALOG: EDITAR FOLLOW-UP
// ==========================================
export interface DialogEditarFollowupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followup: {
    id: string;
    data: string;
    motivo: string;
  } | null;
  onSucesso: () => void;
}

export function DialogEditarFollowup({
  open,
  onOpenChange,
  followup,
  onSucesso,
}: DialogEditarFollowupProps) {
  const [data, setData] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fnEditarFollowup = useServerFn(editarFollowup);

  useEffect(() => {
    if (followup && open) {
      setData(followup.data ? followup.data.slice(0, 10) : obterHojeSP());
      setMotivo(followup.motivo || '');
    }
  }, [followup, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!followup) return;
    if (!motivo.trim()) {
      toast.error('Informe o motivo do follow-up.');
      return;
    }
    setSalvando(true);
    try {
      await fnEditarFollowup({
        data: {
          followupId: followup.id,
          data,
          motivo: motivo.trim(),
        },
      });
      toast.success('Follow-up atualizado com sucesso!');
      onOpenChange(false);
      onSucesso();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar follow-up.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Edit className="h-4 w-4 text-primary" />
            Editar Follow-up Pendente
          </DialogTitle>
          <DialogDescription className="text-xs">
            Altere a data ou o motivo do follow-up.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="data-followup" className="text-xs font-semibold">
              Data do Follow-up
            </Label>
            <Input
              id="data-followup"
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motivo-followup" className="text-xs font-semibold">
              Motivo
            </Label>
            <Input
              id="motivo-followup"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Ligar para alinhar proposta..."
              className="h-9 text-xs"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={salvando}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={salvando} className="text-xs gap-1.5">
              {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// 4. DIALOG: EXCLUIR FOLLOW-UP
// ==========================================
export interface DialogExcluirFollowupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  followup: {
    id: string;
    data?: string;
    motivo?: string;
  } | null;
  onSucesso: () => void;
}

export function DialogExcluirFollowup({
  open,
  onOpenChange,
  followup,
  onSucesso,
}: DialogExcluirFollowupProps) {
  const [excluindo, setExcluindo] = useState(false);
  const fnExcluirFollowup = useServerFn(excluirFollowup);

  async function handleExcluir() {
    if (!followup) return;
    setExcluindo(true);
    try {
      await fnExcluirFollowup({
        data: { followupId: followup.id },
      });
      toast.success('Follow-up excluído com sucesso!');
      onOpenChange(false);
      onSucesso();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir follow-up.');
    } finally {
      setExcluindo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
            <Trash2 className="h-4 w-4" />
            Excluir Follow-up
          </DialogTitle>
          <DialogDescription className="text-xs">
            Tem certeza que deseja excluir este follow-up definitivamente? Esta ação apagará o agendamento por completo (para criados por engano).
          </DialogDescription>
        </DialogHeader>

        {followup && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-1 my-2">
            <p className="font-semibold text-foreground">Motivo: {followup.motivo}</p>
            {followup.data && (
              <p className="text-muted-foreground text-[11px]">
                Data: {formatarData(followup.data)}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={excluindo}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleExcluir}
            disabled={excluindo}
            className="text-xs gap-1.5"
          >
            {excluindo && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Excluir Definitivamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
