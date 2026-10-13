import { useState, useEffect, useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { registrarNotaObra, registrarArquivo, TIPOS_LOTE_LABELS } from '@/lib/obras.functions';
import { obterHojeSP } from '@/lib/date-utils';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Loader2, Paperclip, X, File, UploadCloud } from 'lucide-react';
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

const LIMITE_TAMANHO_BYTES = 20 * 1024 * 1024; // 20 MB

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
  const [dataNota, setDataNota] = useState<string>(obterHojeSP());
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [salvando, setSalvando] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const executarRegistrarNota = useServerFn(registrarNotaObra);
  const executarRegistrarArquivo = useServerFn(registrarArquivo);

  useEffect(() => {
    if (open) {
      setTipo('nota');
      setLoteId(loteIdInicial || 'nenhum');
      setDataNota(obterHojeSP());
      setTexto('');
      setArquivos([]);
      setSalvando(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open, loteIdInicial]);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const selecionados = Array.from(e.target.files);

    const validos: File[] = [];
    for (const f of selecionados) {
      if (f.size > LIMITE_TAMANHO_BYTES) {
        toast.error(`O arquivo "${f.name}" excede o limite máximo de 20 MB.`);
      } else {
        validos.push(f);
      }
    }

    setArquivos((prev) => [...prev, ...validos]);
  }

  function removerArquivo(index: number) {
    setArquivos((prev) => prev.filter((_, i) => i !== index));
  }

  function sanitizarNomeArquivo(nome: string): string {
    return nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const textoLimpo = texto.trim();
    if (!textoLimpo) {
      toast.error('Informe o conteúdo da nota.');
      return;
    }

    try {
      setSalvando(true);

      // 1. Primeiro grava o registro
      const res = await executarRegistrarNota({
        data: {
          obraId,
          loteId: loteId !== 'nenhum' ? loteId : undefined,
          tipo,
          texto: textoLimpo,
          data: dataNota || undefined,
        },
      });

      const novoRegistroId = res.registro.id;

      // 2. Se houver arquivos anexados, envia para o storage e registra vinculando ao registro_id
      if (arquivos.length > 0) {
        for (const file of arquivos) {
          const nomeSanitizado = sanitizarNomeArquivo(file.name);
          const uuid = crypto.randomUUID();
          const caminho = `obras/${obraId}/${uuid}-${nomeSanitizado}`;

          const { error: uploadErr } = await supabase.storage
            .from('arquivos')
            .upload(caminho, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (uploadErr) {
            toast.error(`Falha no upload de "${file.name}": ${uploadErr.message}`);
            continue;
          }

          try {
            await executarRegistrarArquivo({
              data: {
                obraId,
                loteId: loteId !== 'nenhum' ? loteId : undefined,
                registroId: novoRegistroId,
                nome: file.name,
                mime: file.type || undefined,
                tamanho: file.size,
                caminho,
              },
            });
          } catch (regErr: any) {
            await supabase.storage.from('arquivos').remove([caminho]);
            toast.error(`Erro ao vincular "${file.name}": ${regErr.message}`);
          }
        }
      }

      toast.success('Nota registrada com sucesso!');
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
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <FileText className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-wider">Histórico</span>
          </div>
          <DialogTitle className="text-xl font-bold">Registrar nota na obra</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Adicione uma anotação, ata de reunião, ocorrência ou contato operacional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Tipo de Registro *</label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoRegistro)} disabled={salvando}>
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
              <label className="text-xs font-semibold text-foreground">Data do Registro</label>
              <Input
                type="date"
                value={dataNota}
                onChange={(e) => setDataNota(e.target.value)}
                disabled={salvando}
                className="h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Vincular a Lote</label>
              <Select value={loteId} onValueChange={setLoteId} disabled={salvando}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Geral da obra" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nenhum">Geral da obra</SelectItem>
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
              placeholder="Digite os detalhes da nota, ata ou registro..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={salvando}
              rows={4}
              autoFocus
              className="resize-none text-xs"
            />
          </div>

          {/* Anexos opcionais */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5 text-primary" />
                Anexar arquivos (opcional, até 20 MB cada)
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={salvando}
                className="h-7 text-xs gap-1"
              >
                <UploadCloud className="h-3 w-3" />
                Adicionar arquivos
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />

            {arquivos.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-border p-2 bg-muted/40">
                {arquivos.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-2 p-1.5 rounded bg-background border border-border text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        ({(file.size / (1024 * 1024)).toFixed(1)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removerArquivo(idx)}
                      disabled={salvando}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
              disabled={salvando || !texto.trim()}
              className="gap-2 font-semibold"
            >
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
