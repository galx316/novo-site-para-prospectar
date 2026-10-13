import { useState, useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  editarOportunidade,
  criarOportunidade,
  obterOuCriarMarca,
} from '@/lib/prospeccao.functions';
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
  Briefcase,
  Plus,
  Check,
  AlertTriangle,
  User,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { EtapaBadge } from './etapa-badge';
import type { Database } from '@/integrations/supabase/types';

type SituacaoPrado = Database['public']['Enums']['situacao_prado'];

export interface OportunidadeEdicao {
  id: string;
  marca_ids: string[];
  descricao?: string | null;
  contato_id?: string | null;
  etapa?: string | null;
}

interface DialogOportunidadeProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clienteId: string;
  clienteNome: string;
  clienteSituacaoPrado?: SituacaoPrado | null;
  clienteRepresentantePrado?: string | null;
  oportunidade?: OportunidadeEdicao | null;
  contatos?: Array<{ id: string; nome: string; cargo?: string | null; [key: string]: any }>;
  marcasDisponiveis?: Array<{ id: string; nome: string; ativa?: boolean; linha?: string; [key: string]: any }>;
  onSuccess: () => void;
}

export function DialogOportunidade({
  open,
  onOpenChange,
  clienteId,
  clienteNome,
  clienteSituacaoPrado,
  clienteRepresentantePrado,
  oportunidade,
  contatos = [],
  marcasDisponiveis = [],
  onSuccess,
}: DialogOportunidadeProps) {
  const isEditing = !!oportunidade;

  const [marcasLocais, setMarcasLocais] = useState<any[]>([]);
  const [marcasSelecionadas, setMarcasSelecionadas] = useState<string[]>([]);
  const [novaMarcaNome, setNovaMarcaNome] = useState('');
  const [adicionandoMarca, setAdicionandoMarca] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [contatoId, setContatoId] = useState<string>('');
  const [etapa, setEtapa] = useState<'prospeccao' | 'orcamento' | 'negociacao' | 'perdido'>('prospeccao');
  const [confirmouPradoOutroRep, setConfirmouPradoOutroRep] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const etapaBloqueada =
    isEditing &&
    ['aguardando_demanda', 'demanda_prevista', 'fechado'].includes(oportunidade?.etapa || '');

  const fnEditar = useServerFn(editarOportunidade);
  const fnCriar = useServerFn(criarOportunidade);
  const fnCriarMarca = useServerFn(obterOuCriarMarca);

  useEffect(() => {
    if (open) {
      const marcasOpIds = oportunidade?.marca_ids || [];
      // Carrega marcas ativas + marcas que a oportunidade já possui (mesmo inativas)
      const ativasEExistentes = (marcasDisponiveis || []).filter(
        (m: any) => m.ativa !== false || marcasOpIds.includes(m.id)
      );
      setMarcasLocais(ativasEExistentes);

      if (oportunidade) {
        setMarcasSelecionadas([...marcasOpIds]);
        setDescricao(oportunidade.descricao || '');
        setContatoId(oportunidade.contato_id || '');
        if (
          oportunidade.etapa &&
          ['prospeccao', 'orcamento', 'negociacao', 'perdido'].includes(oportunidade.etapa)
        ) {
          setEtapa(oportunidade.etapa as any);
        } else {
          setEtapa('prospeccao');
        }
        setConfirmouPradoOutroRep(true);
      } else {
        const prado = ativasEExistentes.find((m: any) => m.nome === 'PRADO');
        setMarcasSelecionadas(prado ? [prado.id] : ativasEExistentes.slice(0, 1).map((m: any) => m.id));
        setDescricao('');
        setContatoId('');
        setEtapa('prospeccao');
        setConfirmouPradoOutroRep(false);
      }
      setNovaMarcaNome('');
    }
  }, [open, oportunidade, marcasDisponiveis]);

  function toggleMarca(id: string) {
    setMarcasSelecionadas((atuais) =>
      atuais.includes(id) ? atuais.filter((m) => m !== id) : [...atuais, id]
    );
  }

  async function handleAdicionarMarcaPersonalizada() {
    const nome = novaMarcaNome.trim();
    if (!nome) return;
    setAdicionandoMarca(true);
    try {
      const resp = await fnCriarMarca({ data: { nome } });
      if (resp?.marca) {
        setMarcasLocais((prev) => {
          if (prev.some((m) => m.id === resp.marca.id)) return prev;
          return [...prev, resp.marca];
        });
      }
      setMarcasSelecionadas((prev) => (prev.includes(resp.id) ? prev : [...prev, resp.id]));
      setNovaMarcaNome('');
      toast.success(`Marca "${resp?.marca?.nome || nome}" adicionada e selecionada!`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao adicionar marca personalizada.');
    } finally {
      setAdicionandoMarca(false);
    }
  }

  // Regra de aviso: PRADO marcada e construtora atendida por outro representante
  const pradoId = marcasLocais.find((m: any) => m.nome === 'PRADO')?.id;
  const pradoMarcado = pradoId ? marcasSelecionadas.includes(pradoId) : false;
  const construtoraAtendidaOutroRep = clienteSituacaoPrado === 'atendida_outro_rep';
  const alertaPradoAtivo = pradoMarcado && construtoraAtendidaOutroRep;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (marcasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma marca.');
      return;
    }

    if (alertaPradoAtivo && !confirmouPradoOutroRep) {
      toast.warning('Por favor confirme que está ciente sobre a representação da PRADO.');
      return;
    }

    setCarregando(true);
    try {
      if (isEditing && oportunidade) {
        await fnEditar({
          data: {
            clienteId,
            oportunidadeId: oportunidade.id,
            marcaIds: marcasSelecionadas,
            descricao: descricao.trim() || undefined,
            contatoId: contatoId || undefined,
            etapa: !etapaBloqueada ? etapa : undefined,
          },
        });
        toast.success('Oportunidade atualizada com sucesso!');
      } else {
        await fnCriar({
          data: {
            clienteId,
            marcaIds: marcasSelecionadas,
            descricao: descricao.trim() || undefined,
            contatoId: contatoId || undefined,
            etapa,
          },
        });
        toast.success('Nova oportunidade criada com sucesso!');
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar oportunidade.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            {isEditing ? 'Editar Oportunidade' : 'Nova Oportunidade'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {clienteNome}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* 1. Marcas de interesse */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Marcas de interesse *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {marcasLocais.map((m) => {
                const checked = marcasSelecionadas.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMarca(m.id)}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                      checked
                        ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                        : 'border-border bg-card text-foreground hover:bg-accent'
                    }`}
                  >
                    <div
                      className={`h-4 w-4 rounded-sm border flex items-center justify-center ${
                        checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                      }`}
                    >
                      {checked && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span className="truncate">{m.nome}</span>
                  </button>
                );
              })}
            </div>

            {/* Opção Marca Personalizada */}
            <div className="pt-2 border-t border-border/60">
              <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                Personalizada:
              </label>
              <div className="flex gap-2">
                <Input
                  value={novaMarcaNome}
                  onChange={(e) => setNovaMarcaNome(e.target.value)}
                  placeholder="Nome de outra marca"
                  className="h-9 bg-background text-xs"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdicionarMarcaPersonalizada();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAdicionarMarcaPersonalizada}
                  disabled={adicionandoMarca || !novaMarcaNome.trim()}
                  className="h-9 text-xs px-3 font-semibold shrink-0 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {adicionandoMarca ? 'Adicionando...' : 'Adicionar'}
                </Button>
              </div>
            </div>

            {/* Aviso Regra de Negócio: PRADO atendida por outro representante */}
            {alertaPradoAtivo && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive animate-in fade-in space-y-2 mt-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Atenção:</strong> Esta construtora já é atendida por outro representante PRADO (
                    {clienteRepresentantePrado || 'outro representante'}).
                    <p className="mt-1 text-muted-foreground">
                      Sugerimos ofertar as marcas <strong>Scalla</strong> (esquadrias) ou <strong>Kit Porta (Rohden/Imab)</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-destructive/20">
                  <Checkbox
                    id="confirmar-prado-op"
                    checked={confirmouPradoOutroRep}
                    onCheckedChange={(c) => setConfirmouPradoOutroRep(!!c)}
                  />
                  <label
                    htmlFor="confirmar-prado-op"
                    className="font-medium cursor-pointer text-foreground text-xs"
                  >
                    Estou ciente e desejo manter a marca PRADO selecionada nesta oportunidade.
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 2. Etapa da oportunidade */}
          <div className="space-y-1 pt-1 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Etapa
            </label>
            {etapaBloqueada ? (
              <div className="flex items-center gap-2 py-1">
                <EtapaBadge etapa={oportunidade?.etapa as any} />
                <span className="text-xs text-muted-foreground">
                  (Etapa gerenciada pelo fluxo da obra/oportunidade)
                </span>
              </div>
            ) : (
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value as any)}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium"
              >
                <option value="prospeccao">Prospecção</option>
                <option value="orcamento">Orçamento</option>
                <option value="negociacao">Negociação</option>
                <option value="perdido">Perdido</option>
              </select>
            )}
          </div>

          {/* 3. Contato principal */}
          <div className="space-y-1 pt-1 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Contato principal (opcional)
            </label>
            <select
              value={contatoId}
              onChange={(e) => setContatoId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-xs font-medium"
            >
              <option value="">Sem contato</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} {c['cargo'] ? `(${c['cargo']})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Descrição da oportunidade */}
          <div className="space-y-1 pt-1 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground block mb-1">
              Descrição / Observações da oportunidade (opcional)
            </label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Empreendimento em fase de projeto executivo, entrega para final do ano."
              rows={3}
              className="bg-background resize-none text-xs"
            />
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
              {carregando
                ? 'Salvando...'
                : isEditing
                ? 'Salvar Alterações'
                : 'Criar Oportunidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
