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

export interface OportunidadeItem {
  id: string;
  contato_id?: string | null;
  descricao?: string | null;
  marcas?: Array<{ id: string; nome: string; [key: string]: any }> | null;
}

export interface ContatoItem {
  id: string;
  nome: string;
  cargo?: string | null;
}

interface DialogEnvieiProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contatoId?: string;
  contatoNome?: string;
  contatos?: ContatoItem[];
  clienteNome?: string;
  oportunidades?: OportunidadeItem[];
  atalhosDias?: number[];
  onSuccess: () => void;
}

export function DialogEnviei({
  open,
  onOpenChange,
  contatoId,
  contatoNome,
  contatos,
  clienteNome,
  oportunidades = [],
  atalhosDias = [3, 7, 15, 30],
  onSuccess,
}: DialogEnvieiProps) {
  const [contatoEscolhidoId, setContatoEscolhidoId] = useState<string>(contatoId || '');
  const [canal, setCanal] = useState<TipoRegistro>('whatsapp');
  const [texto, setTexto] = useState('');
  const [motivoFollowup, setMotivoFollowup] = useState('');
  const [dataProxima, setDataProxima] = useState<string>('');
  const [modoEscolherData, setModoEscolherData] = useState(false);
  const [carregando, setCarregando] = useState(false);

  // Define contato ativo inicial
  useEffect(() => {
    if (open) {
      if (contatoId) {
        setContatoEscolhidoId(contatoId);
      } else if (contatos && contatos.length > 0) {
        setContatoEscolhidoId(contatos[0]?.id || '');
      } else {
        setContatoEscolhidoId('');
      }
    }
  }, [open, contatoId, contatos]);

  const contatoAtivoId = (contatos && contatos.length > 0 ? contatoEscolhidoId : contatoId) || contatoId || '';

  // Mostre só as oportunidades do contato escolhido ou sem contato (contato_id nulo).
  // Nunca envie oportunidade de outro contato.
  const oportunidadesValidas = (oportunidades || []).filter(
    (op) => !op.contato_id || (contatoAtivoId && op.contato_id === contatoAtivoId)
  );

  const [oportunidadeSelecionadaId, setOportunidadeSelecionadaId] = useState<string>('');

  const executarEnvio = useServerFn(registrarEnvio);

  // Inicializar com o primeiro atalho e a oportunidade padrão
  useEffect(() => {
    if (open) {
      const primeiroAtalho = atalhosDias?.[0] || 5;
      setDataProxima(adicionarDiasSP(primeiroAtalho));
      setModoEscolherData(false);
      setTexto('');
      setMotivoFollowup('');
      setCanal('whatsapp');
    }
  }, [open, atalhosDias]);

  useEffect(() => {
    if (open) {
      if (oportunidadesValidas.length > 0) {
        setOportunidadeSelecionadaId(oportunidadesValidas[0]?.id || '');
      } else {
        setOportunidadeSelecionadaId('');
      }
    }
  }, [open, contatoAtivoId, oportunidades]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contatoAtivoId) {
      toast.error('Nenhum contato selecionado.');
      return;
    }

    // Se houver só uma, use essa sem perguntar.
    // Se houver mais de uma, use a selecionada.
    // Se não houver nenhuma, envie sem oportunidade.
    const oportunidadeFinalId =
      oportunidadesValidas.length === 1
        ? oportunidadesValidas[0]?.id
        : oportunidadesValidas.length > 1
          ? (oportunidadeSelecionadaId || oportunidadesValidas[0]?.id || undefined)
          : undefined;

    setCarregando(true);
    try {
      await executarEnvio({
        data: {
          contatoId: contatoAtivoId,
          canal,
          oportunidadeId: oportunidadeFinalId || undefined,
          texto: texto.trim() || undefined,
          motivo: motivoFollowup.trim() || undefined,
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

  const contatoExibicao = contatos?.find((c) => c.id === contatoAtivoId)?.nome || contatoNome;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Registrar Envio de Apresentação</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {clienteNome && <span className="font-semibold text-foreground">{clienteNome}</span>}
            {(!contatos || contatos.length <= 1) && contatoExibicao && ` • Contato: ${contatoExibicao}`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2">
          {/* Seletor de Contato (se contatos tiver mais de 1 item) */}
          {contatos && contatos.length > 1 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Contato
              </label>
              <select
                value={contatoEscolhidoId}
                onChange={(e) => setContatoEscolhidoId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {contatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}{c.cargo ? ` (${c.cargo})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
          {/* Seletor de Oportunidade (mostrado se houver mais de uma válida) */}
          {oportunidadesValidas.length > 1 && (
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Oportunidade vinculada
              </label>
              <select
                value={oportunidadeSelecionadaId}
                onChange={(e) => setOportunidadeSelecionadaId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {oportunidadesValidas.map((op) => {
                  const marcasNomes = (op.marcas || []).map((m) => m.nome).filter(Boolean).join(', ');
                  const rotulo =
                    marcasNomes && op.descricao
                      ? `${marcasNomes} — ${op.descricao}`
                      : marcasNomes || op.descricao || 'Oportunidade comercial';
                  return (
                    <option key={op.id} value={op.id}>
                      {rotulo}
                    </option>
                  );
                })}
              </select>
            </div>
          )}

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

            {/* Motivo opcional do próximo follow-up */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2">
                Motivo do próximo follow-up (opcional)
              </label>
              <input
                type="text"
                value={motivoFollowup}
                onChange={(e) => setMotivoFollowup(e.target.value)}
                placeholder="Ex: Perguntar da equalização do orçamento da obra de Hortolândia"
                className="w-full h-11 px-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
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
