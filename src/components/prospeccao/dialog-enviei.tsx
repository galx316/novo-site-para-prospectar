import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { registrarEnvio } from '@/lib/prospeccao.functions';
import { adicionarDiasSP, formatarData, obterHojeSP } from '@/lib/date-utils';
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
import { MessageSquare, Mail, Phone, Calendar as CalendarIcon, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];

interface DialogEnvieiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contatoId: string;
  contatoNome?: string;
  clienteNome?: string;
  oportunidadeId?: string;
  atalhosDias?: number[];
  onSuccess: () => void;
}

export function DialogEnviei({
  open,
  onOpenChange,
  contatoId,
  contatoNome,
  clienteNome,
  oportunidadeId,
  atalhosDias = [3, 7, 15, 30],
  onSuccess,
}: DialogEnvieiProps) {
  const [canal, setCanal] = useState<TipoRegistro>('whatsapp');
  const [texto, setTexto] = useState('');
  const [dataProxima, setDataProxima] = useState<string>('');
  const [modoEscolherData, setModoEscolherData] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const executarEnvio = useServerFn(registrarEnvio);

  // Inicializar com o primeiro atalho (ex: +3 ou +5 dias)
  useEffect(() => {
    if (open) {
      const primeiroAtalho = atalhosDias?.[0] || 5;
      setDataProxima(adicionarDiasSP(primeiroAtalho));
      setModoEscolherData(false);
      setTexto('');
      setCanal('whatsapp');
    }
  }, [open, atalhosDias]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contatoId) {
      toast.error('Nenhum contato selecionado.');
      return;
    }

    setCarregando(true);
    try {
      await executarEnvio({
        data: {
          contatoId,
          canal,
          oportunidadeId: oportunidadeId || undefined,
          texto: texto.trim() || undefined,
          dataProxima: dataProxima || undefined,
        },
      });

      toast.success('Envio registrado com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar envio.');
    } finally {
      setCarregando(false);
    }
  }

  const canais: { tipo: TipoRegistro; label: string; icon: any }[] = [
    { tipo: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
    { tipo: 'email', label: 'E-mail', icon: Mail },
    { tipo: 'ligacao', label: 'Ligação', icon: Phone },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Registrar Envio de Apresentação</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome && <span className="font-semibold text-foreground">{clienteNome}</span>}
            {contatoNome && ` • Contato: ${contatoNome}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Escolha do Canal */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Canal utilizado
            </label>
            <div className="grid grid-cols-3 gap-2">
              {canais.map((c) => {
                const Icon = c.icon;
                const selecionado = canal === c.tipo;
                return (
                  <button
                    key={c.tipo}
                    type="button"
                    onClick={() => setCanal(c.tipo)}
                    className={`flex flex-col items-center justify-center gap-1.5 h-18 rounded-lg border text-sm font-medium transition-all ${
                      selecionado
                        ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs ring-1 ring-primary'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Próximo follow-up e atalhos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Próximo Follow-up
              </label>
              <span className="text-xs font-semibold text-primary">
                Agendado para: {formatarData(dataProxima)}
              </span>
            </div>

            {/* Atalhos rápidos de dias */}
            <div className="flex flex-wrap gap-1.5">
              {atalhosDias.map((dias) => {
                const dataCalculada = adicionarDiasSP(dias);
                const ativo = dataProxima === dataCalculada && !modoEscolherData;
                return (
                  <button
                    key={dias}
                    type="button"
                    onClick={() => {
                      setDataProxima(dataCalculada);
                      setModoEscolherData(false);
                    }}
                    className={`flex-1 min-w-[70px] h-11 rounded-md text-xs font-semibold border transition-all ${
                      ativo
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'border-border bg-card hover:bg-accent text-foreground'
                    }`}
                  >
                    +{dias} dias
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setModoEscolherData(true)}
                className={`flex-1 min-w-[100px] h-11 rounded-md text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                  modoEscolherData
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                    : 'border-border bg-card hover:bg-accent text-foreground'
                }`}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Escolher data
              </button>
            </div>

            {/* Input customizado de data quando clicado em Escolher data */}
            {modoEscolherData && (
              <div className="pt-2 animate-in fade-in slide-in-from-top-1">
                <input
                  type="date"
                  min={obterHojeSP()}
                  value={dataProxima}
                  onChange={(e) => setDataProxima(e.target.value)}
                  className="w-full h-11 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            )}
          </div>

          {/* Anotação opcional */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
              Observações do envio (opcional)
            </label>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Ex: Enviado catálogo 2026 e apresentação por WhatsApp."
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 w-full sm:w-auto"
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="h-12 w-full sm:w-auto font-medium gap-2"
              disabled={carregando}
            >
              {carregando ? (
                'Registrando...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Confirmar Envio
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
