import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { registrarAtividade } from '@/lib/prospeccao.functions';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Phone,
  MapPin,
  Mail,
  FileText,
  Sparkles,
  Calendar as CalendarIcon,
  Check,
  User,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type TipoRegistro = Database['public']['Enums']['tipo_registro'];

export interface OportunidadeItem {
  id: string;
  contato_id?: string | null;
  descricao?: string | null;
  marcas?: Array<{ id: string; nome: string; [key: string]: any }> | null;
}

interface DialogRegistrarAtividadeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  contatoId?: string | null;
  contatos?: Array<{ id: string; nome: string; cargo?: string | null; [key: string]: any }>;
  oportunidades?: OportunidadeItem[];
  atalhosDias?: number[];
  onSuccess: () => void;
}

const TIPOS_ATIVIDADE: Array<{
  tipo: TipoRegistro;
  label: string;
  icon: any;
}> = [
  { tipo: 'ligacao', label: 'Ligação', icon: Phone },
  { tipo: 'visita', label: 'Visita à obra', icon: MapPin },
  { tipo: 'email', label: 'E-mail', icon: Mail },
  { tipo: 'nota', label: 'Nota', icon: FileText },
  { tipo: 'outro', label: 'Personalizada', icon: Sparkles },
];

export function DialogRegistrarAtividade({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  contatoId,
  contatos = [],
  oportunidades = [],
  atalhosDias = [3, 7, 15, 30],
  onSuccess,
}: DialogRegistrarAtividadeProps) {
  const [tipo, setTipo] = useState<TipoRegistro>('ligacao');
  const [nomeAtividade, setNomeAtividade] = useState('');
  const [descricao, setDescricao] = useState('');
  const [contatoSelecionadoId, setContatoSelecionadoId] = useState<string>('');
  const [oportunidadeSelecionadaId, setOportunidadeSelecionadaId] = useState<string>('');

  // Próximo passo (opcional)
  const [temProximoPasso, setTemProximoPasso] = useState(false);
  const [dataProxima, setDataProxima] = useState<string>('');
  const [motivoProximoPasso, setMotivoProximoPasso] = useState('');
  const [modoEscolherData, setModoEscolherData] = useState(false);

  const [carregando, setCarregando] = useState(false);

  const executarRegistro = useServerFn(registrarAtividade);

  useEffect(() => {
    if (open) {
      setTipo('ligacao');
      setNomeAtividade('');
      setDescricao('');
      setContatoSelecionadoId(contatoId || (contatos[0]?.id ?? ''));
      setOportunidadeSelecionadaId('');
      setTemProximoPasso(false);
      setDataProxima(adicionarDiasSP(atalhosDias[0] || 5));
      setMotivoProximoPasso('');
      setModoEscolherData(false);
    }
  }, [open, contatoId, contatos, atalhosDias]);

  // Regra de filtro de oportunidade: mesma regra do Enviei e Respondeu
  const oportunidadesValidas = (oportunidades || []).filter(
    (op) => !op.contato_id || (contatoSelecionadoId && op.contato_id === contatoSelecionadoId)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (tipo === 'outro' && !nomeAtividade.trim()) {
      toast.error('Informe o nome da atividade personalizada.');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Informe a descrição da atividade.');
      return;
    }

    const textoFinal =
      tipo === 'outro'
        ? `${nomeAtividade.trim()}: ${descricao.trim()}`
        : descricao.trim();

    setCarregando(true);
    try {
      await executarRegistro({
        data: {
          clienteId,
          contatoId: contatoSelecionadoId || undefined,
          oportunidadeId: oportunidadeSelecionadaId || undefined,
          tipo,
          texto: textoFinal,
          dataProxima: temProximoPasso && dataProxima ? dataProxima : undefined,
          motivo: temProximoPasso && motivoProximoPasso.trim() ? motivoProximoPasso.trim() : undefined,
        },
      });

      toast.success('Atividade registrada com sucesso!');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar atividade.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Registrar Atividade
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {clienteNome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Seleção de Tipo de Atividade */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
              Tipo de Atividade *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TIPOS_ATIVIDADE.map((item) => {
                const Icon = item.icon;
                const selecionado = tipo === item.tipo;
                return (
                  <button
                    key={item.tipo}
                    type="button"
                    onClick={() => setTipo(item.tipo)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      selecionado
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Se Personalizada: Nome da Atividade */}
          {tipo === 'outro' && (
            <div className="space-y-1 animate-in fade-in">
              <label className="text-xs font-semibold text-muted-foreground block">
                Nome da Atividade *
              </label>
              <Input
                value={nomeAtividade}
                onChange={(e) => setNomeAtividade(e.target.value)}
                placeholder="Ex: Alinhamento de projeto, Apresentação técnica"
                className="h-10 bg-background"
                required
              />
            </div>
          )}

          {/* Seleção de Contato e Oportunidade */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Contato (opcional)
              </label>
              <select
                value={contatoSelecionadoId}
                onChange={(e) => setContatoSelecionadoId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium"
              >
                <option value="">Geral da construtora</option>
                {contatos.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Oportunidade (opcional)
              </label>
              <select
                value={oportunidadeSelecionadaId}
                onChange={(e) => setOportunidadeSelecionadaId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium"
              >
                <option value="">Nenhuma / Geral</option>
                {oportunidadesValidas.map((op) => {
                  const nomesMarcas = (op.marcas || []).map((m: any) => m.nome).join(', ');
                  const rotulo = nomesMarcas || op.descricao || 'Oportunidade';
                  return (
                    <option key={op.id} value={op.id}>
                      {rotulo}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Campo Descrição */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground block">
              Descrição da atividade *
            </label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o que foi conversado ou realizado..."
              rows={3}
              className="bg-background resize-none"
              required
            />
          </div>

          {/* Próximo passo opcional */}
          <div className="rounded-lg border border-border bg-accent/30 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="check-proximo-passo"
                checked={temProximoPasso}
                onCheckedChange={(c) => setTemProximoPasso(!!c)}
              />
              <label
                htmlFor="check-proximo-passo"
                className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-1.5"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                Agendar Próximo Passo
              </label>
            </div>

            {temProximoPasso && (
              <div className="space-y-3 pt-2 border-t border-border/70 animate-in fade-in">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                    Data do próximo passo:
                  </label>
                  {!modoEscolherData ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {atalhosDias.map((dias) => {
                        const dataCalculada = adicionarDiasSP(dias);
                        const ativa = dataProxima === dataCalculada;
                        return (
                          <Button
                            key={dias}
                            type="button"
                            size="sm"
                            variant={ativa ? 'default' : 'outline'}
                            onClick={() => setDataProxima(dataCalculada)}
                            className="h-8 text-xs font-semibold"
                          >
                            +{dias}d ({formatarData(dataCalculada)})
                          </Button>
                        );
                      })}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setModoEscolherData(true)}
                        className="h-8 text-xs font-medium text-primary"
                      >
                        Outra data
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        min={obterHojeSP()}
                        value={dataProxima}
                        onChange={(e) => setDataProxima(e.target.value)}
                        className="h-9 bg-background text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setModoEscolherData(false)}
                        className="h-9 text-xs"
                      >
                        Voltar aos atalhos
                      </Button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Motivo do próximo passo (opcional)
                  </label>
                  <Input
                    value={motivoProximoPasso}
                    onChange={(e) => setMotivoProximoPasso(e.target.value)}
                    placeholder="Ex: Visitar a obra para conseguir o contato do engenheiro"
                    className="h-9 bg-background text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={carregando}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={carregando} className="gap-1.5 font-semibold">
              <Check className="h-4 w-4" />
              {carregando ? 'Registrando...' : 'Registrar Atividade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
