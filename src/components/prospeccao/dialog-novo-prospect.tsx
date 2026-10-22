import { useState, useEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { buscarClientesRPC, criarProspect, obterOuCriarMarca } from '@/lib/prospeccao.functions';
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
  Building2,
  User,
  Phone,
  Mail,
  FileText,
  AlertTriangle,
  Check,
  Send,
  ExternalLink,
  Search,
  Sparkles,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { SeloPrado } from './selo-prado';
import type { Database } from '@/integrations/supabase/types';

type SituacaoPrado = Database['public']['Enums']['situacao_prado'];
type TipoRegistro = Database['public']['Enums']['tipo_registro'];

interface Marca {
  id: string;
  nome: string;
  linha?: string;
  cor?: string | null;
  ativa?: boolean;
}

interface DialogNovoProspectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marcasDisponiveis: Marca[];
  onSuccess: () => void;
  initialValues?: {
    nomeContato?: string | undefined;
    whatsapp?: string | undefined;
  } | undefined;
}

export function DialogNovoProspect({
  open,
  onOpenChange,
  marcasDisponiveis,
  onSuccess,
  initialValues,
}: DialogNovoProspectProps) {
  const navigate = useNavigate();

  // Estados dos campos da construtora
  const [nomeConstrutora, setNomeConstrutora] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [situacaoPrado, setSituacaoPrado] = useState<SituacaoPrado>('nao_verificado');
  const [representantePrado, setRepresentantePrado] = useState('');

  // Estados do contato
  const [nomeContato, setNomeContato] = useState('');
  const [cargoContato, setCargoContato] = useState('');
  const [telefone, setTelefone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');

  // Estados das marcas
  const [marcasLocais, setMarcasLocais] = useState<Marca[]>([]);
  const [marcasSelecionadas, setMarcasSelecionadas] = useState<string[]>([]);
  const [novaMarcaNome, setNovaMarcaNome] = useState('');
  const [adicionandoMarca, setAdicionandoMarca] = useState(false);
  const [descricao, setDescricao] = useState('');
  const [etapa, setEtapa] = useState<'prospeccao' | 'orcamento' | 'negociacao' | 'perdido'>('prospeccao');

  // Construtora existente selecionada (opcional)
  const [clienteSelecionado, setClienteSelecionado] = useState<{
    id: string;
    nome: string;
    situacao_prado: SituacaoPrado;
    representante_prado: string | null;
  } | null>(null);

  // Sugestões de buscar_clientes
  const [sugestoes, setSugestoes] = useState<any[]>([]);
  const [buscandoSugestoes, setBuscandoSugestoes] = useState(false);
  const [ignorarParecidas, setIgnorarParecidas] = useState(false);

  // Avisos de Prado / Confirmação
  const [confirmouPradoOutroRep, setConfirmouPradoOutroRep] = useState(false);

  // Pergunta pós-preenchimento: "Já enviou a apresentação?"
  const [jaEnviouApresentacao, setJaEnviouApresentacao] = useState(false);
  const [canalEnvio, setCanalEnvio] = useState<TipoRegistro>('whatsapp');
  const [situacoesPorMarca, setSituacoesPorMarca] = useState<
    Record<string, { situacao: SituacaoPrado; representante?: string | undefined }>
  >({});

  // Mensagens de erro amigável (duplicidade)
  const [erroDuplicado, setErroDuplicado] = useState<{
    tipo: 'cliente' | 'contato';
    mensagem: string;
    clienteId?: string;
    clienteNome?: string;
  } | null>(null);

  const [carregando, setCarregando] = useState(false);

  const buscarClientes = useServerFn(buscarClientesRPC);
  const submeterCriacao = useServerFn(criarProspect);
  const criarMarcaFn = useServerFn(obterOuCriarMarca);

  const buscaTimeoutRef = useRef<any>(null);

  // Resetar ao abrir
  useEffect(() => {
    if (open) {
      setNomeConstrutora('');
      setCidade('');
      setUf('');
      setSituacaoPrado('nao_verificado');
      setRepresentantePrado('');
      setNomeContato(initialValues?.nomeContato || '');
      setCargoContato('');
      setTelefone('');
      setWhatsapp(initialValues?.whatsapp || '');
      setEmail('');
      setSituacoesPorMarca({});

      // Marcas ativas como opções de escolha
      const ativas = (marcasDisponiveis || []).filter((m: any) => m.ativa !== false);
      setMarcasLocais(ativas);
      const prado = ativas.find((m) => m.nome === 'PRADO');
      setMarcasSelecionadas(prado ? [prado.id] : ativas.slice(0, 1).map((m) => m.id));

      setNovaMarcaNome('');
      setDescricao('');
      setEtapa('prospeccao');
      setClienteSelecionado(null);
      setSugestoes([]);
      setIgnorarParecidas(false);
      setConfirmouPradoOutroRep(false);
      setJaEnviouApresentacao(false);
      setCanalEnvio('whatsapp');
      setErroDuplicado(null);
    }
  }, [open, marcasDisponiveis, initialValues]);

  // Busca em tempo real enquanto digita a construtora
  function handleNomeConstrutoraChange(val: string) {
    setNomeConstrutora(val);
    setClienteSelecionado(null);
    setErroDuplicado(null);
    setIgnorarParecidas(false);

    if (buscaTimeoutRef.current) {
      clearTimeout(buscaTimeoutRef.current);
    }

    if (val.trim().length >= 2) {
      setBuscandoSugestoes(true);
      buscaTimeoutRef.current = setTimeout(async () => {
        try {
          const res = await buscarClientes({ data: { texto: val.trim(), limite: 5 } });
          setSugestoes(res || []);
        } catch {
          setSugestoes([]);
        } finally {
          setBuscandoSugestoes(false);
        }
      }, 300);
    } else {
      setSugestoes([]);
      setBuscandoSugestoes(false);
    }
  }

  function handleUsarCliente(sugestao: any) {
    setClienteSelecionado({
      id: sugestao.id,
      nome: sugestao.nome,
      situacao_prado: sugestao.situacao_prado,
      representante_prado: sugestao.representante_prado,
    });
    setNomeConstrutora(sugestao.nome);
    setSugestoes([]);
    setErroDuplicado(null);
  }

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
      const resp = await criarMarcaFn({ data: { nome } });
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

  // Verifica se PRADO está marcado e se a construtora é atendida por outro representante
  const pradoId = marcasLocais.find((m) => m.nome === 'PRADO')?.id;
  const pradoMarcado = pradoId ? marcasSelecionadas.includes(pradoId) : false;
  const construtoraAtendidaOutroRep =
    clienteSelecionado?.situacao_prado === 'atendida_outro_rep' ||
    (!clienteSelecionado && situacaoPrado === 'atendida_outro_rep');
  const alertaPradoAtivo = pradoMarcado && construtoraAtendidaOutroRep;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErroDuplicado(null);

    if (!clienteSelecionado && !nomeConstrutora.trim()) {
      toast.error('Informe o nome da construtora.');
      return;
    }
    if (!nomeContato.trim()) {
      toast.error('Informe o nome do contato.');
      return;
    }
    if (marcasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma marca.');
      return;
    }

    // Se houver alerta de PRADO atendida por outro e o usuário ainda não confirmou
    if (alertaPradoAtivo && !confirmouPradoOutroRep) {
      toast.warning('Por favor confirme que está ciente sobre a representação da PRADO.');
      return;
    }

    setCarregando(true);
    try {
      const situacoesPayload = marcasSelecionadas
        .filter((id) => id !== pradoId)
        .map((id) => ({
          marcaId: id,
          situacao: (situacoesPorMarca[id]?.situacao || 'nao_verificado') as SituacaoPrado,
          representante:
            situacoesPorMarca[id]?.situacao === 'atendida_outro_rep'
              ? situacoesPorMarca[id]?.representante?.trim() || undefined
              : undefined,
        }));

      const resp = await submeterCriacao({
        data: {
          usarClienteId: clienteSelecionado?.id,
          nomeCliente: nomeConstrutora.trim(),
          cidade: cidade.trim() || undefined,
          uf: uf.trim() || undefined,
          situacaoPrado: !clienteSelecionado ? situacaoPrado : undefined,
          representantePrado:
            !clienteSelecionado && situacaoPrado === 'atendida_outro_rep'
              ? representantePrado.trim()
              : undefined,
          nomeContato: nomeContato.trim(),
          cargo: cargoContato.trim() || undefined,
          telefone: telefone.trim() || undefined,
          whatsapp: whatsapp.trim() || undefined,
          email: email.trim() || undefined,
          marcaIds: marcasSelecionadas,
          descricao: descricao.trim() || undefined,
          etapa,
          jaEnviouApresentacao,
          canalEnvio: jaEnviouApresentacao ? canalEnvio : undefined,
          situacoes: situacoesPayload,
        },
      });

      if (!resp.success) {
        if (resp.erro === 'cliente_duplicado') {
          setErroDuplicado({
            tipo: 'cliente',
            mensagem: resp.mensagem || 'Esta construtora já está cadastrada no sistema.',
            clienteId: (resp as any).clienteExistente?.id,
            clienteNome: (resp as any).clienteExistente?.nome || nomeConstrutora,
          });
          return;
        }

        if (resp.erro === 'contato_duplicado') {
          setErroDuplicado({
            tipo: 'contato',
            mensagem: resp.mensagem || 'Este WhatsApp já pertence a outro contato cadastrado.',
            clienteId: (resp as any).clienteExistenteId,
          });
          return;
        }

        toast.error(resp.mensagem || 'Não foi possível cadastrar o prospect.');
        return;
      }

      toast.success(
        jaEnviouApresentacao
          ? 'Prospect cadastrado e envio registrado!'
          : 'Novo prospect cadastrado com sucesso!'
      );
      onOpenChange(false);
      onSuccess();

      // Redireciona para a ficha do cliente recém-criado
      if (resp.clienteId) {
        navigate({
          to: '/prospeccao/$clienteId',
          params: { clienteId: resp.clienteId },
        });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao criar prospect.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-6 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Novo Prospect
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Cadastre uma nova construtora, seu contato e as oportunidades comerciais.
          </DialogDescription>
        </DialogHeader>

        {/* Notificação amigável de duplicidade se ocorrer */}
        {erroDuplicado && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm animate-in fade-in">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-foreground">{erroDuplicado.mensagem}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Você pode acessar diretamente a ficha existente para adicionar o contato ou registrar novo follow-up.
                </p>
                {erroDuplicado.clienteId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 gap-1.5 h-9 bg-card font-semibold"
                    onClick={() => {
                      onOpenChange(false);
                      navigate({
                        to: '/prospeccao/$clienteId',
                        params: { clienteId: erroDuplicado.clienteId! },
                      });
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir ficha
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 pt-1">
          {/* 1. Bloco Construtora */}
          <div className="space-y-3">
            <div className="relative">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Construtora *
              </label>
              <div className="relative">
                <Input
                  value={nomeConstrutora}
                  onChange={(e) => handleNomeConstrutoraChange(e.target.value)}
                  placeholder="Nome da construtora (ex: Construtora Moura)"
                  className="h-11 pl-9 bg-card"
                  required
                />
                <Building2 className="h-4 w-4 text-muted-foreground absolute left-3 top-3.5" />
                {buscandoSugestoes && (
                  <Search className="h-4 w-4 text-primary animate-spin absolute right-3 top-3.5" />
                )}
              </div>

              {/* Construtora existente selecionada */}
              {clienteSelecionado && (
                <div className="mt-2 flex items-center justify-between rounded-md bg-primary/10 border border-primary/20 px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">
                    Usando construtora existente: <strong>{clienteSelecionado.nome}</strong>
                  </span>
                  <SeloPrado
                    situacao={clienteSelecionado.situacao_prado}
                    representante={clienteSelecionado.representante_prado}
                  />
                </div>
              )}

              {/* Sugestões de busca encontradas (até 5 parecidas com selo de situação) */}
              {sugestoes.length > 0 && !clienteSelecionado && !ignorarParecidas && (
                <div className="mt-2 rounded-lg border border-border bg-card shadow-md p-2 space-y-1 animate-in fade-in">
                  <p className="text-[11px] font-semibold text-muted-foreground px-2 py-1">
                    Construtoras parecidas já cadastradas:
                  </p>
                  {sugestoes.slice(0, 5).map((sug) => (
                    <div
                      key={sug.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-accent/70 transition-colors"
                    >
                      <div className="flex-1 pr-2">
                        <div className="text-sm font-semibold text-foreground">{sug.nome}</div>
                        <SeloPrado
                          situacao={sug.situacao_prado}
                          representante={sug.representante_prado}
                          className="mt-1"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => handleUsarCliente(sug)}
                        className="h-8 text-xs font-semibold"
                      >
                        Usar esta
                      </Button>
                    </div>
                  ))}

                  <div className="pt-1.5 border-t border-border mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setIgnorarParecidas(true);
                        setSugestoes([]);
                      }}
                      className="w-full text-xs text-muted-foreground hover:text-foreground h-8 font-medium"
                    >
                      É outra empresa, criar nova
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Cidade, UF e Situação (visíveis se criando nova) */}
            {!clienteSelecionado && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Cidade (opcional)"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="h-10 bg-card text-sm"
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="UF (ex: SP)"
                      maxLength={2}
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase())}
                      className="h-10 bg-card text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1">
                      Situação do cliente
                    </label>
                    <select
                      value={situacaoPrado}
                      onChange={(e) => setSituacaoPrado(e.target.value as SituacaoPrado)}
                      className="w-full h-10 px-3 rounded-lg border border-input bg-card text-xs font-medium"
                    >
                      <option value="nao_verificado">Não verificado</option>
                      <option value="livre">Livre</option>
                      <option value="ja_cliente">Já é cliente</option>
                      <option value="atendida_outro_rep">Atendido por outro representante</option>
                    </select>
                  </div>

                  {situacaoPrado === 'atendida_outro_rep' && (
                    <div>
                      <label className="text-xs font-semibold text-destructive block mb-1">
                        Nome do representante
                      </label>
                      <Input
                        placeholder="Ex: Carlos Silva"
                        value={representantePrado}
                        onChange={(e) => setRepresentantePrado(e.target.value)}
                        className="h-10 bg-card text-xs"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Bloco Contato */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contato Principal
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Input
                  placeholder="Nome do contato *"
                  value={nomeContato}
                  onChange={(e) => setNomeContato(e.target.value)}
                  className="h-11 pl-9 bg-card"
                  required
                />
                <User className="h-4 w-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
              <div>
                <Input
                  placeholder="Cargo (ex: Diretor de Suprimentos)"
                  value={cargoContato}
                  onChange={(e) => setCargoContato(e.target.value)}
                  className="h-11 bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Input
                  placeholder="Telefone (fixo) - opcional"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="h-11 bg-card text-sm"
                />
              </div>
              <div className="relative">
                <Input
                  placeholder="WhatsApp - opcional"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="h-11 pl-9 bg-card text-sm"
                />
                <Phone className="h-4 w-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="E-mail - opcional"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-9 bg-card text-sm"
                />
                <Mail className="h-4 w-4 text-muted-foreground absolute left-3 top-3.5" />
              </div>
            </div>
          </div>

          {/* 3. Bloco Marcas */}
          <div className="space-y-2 pt-2 border-t border-border">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
              Marcas de interesse *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {marcasLocais.map((m) => {
                const checked = marcasSelecionadas.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMarca(m.id)}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-sm font-semibold transition-all ${
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
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nome da marca personalizada"
                  value={novaMarcaNome}
                  onChange={(e) => setNovaMarcaNome(e.target.value)}
                  className="h-9 bg-card text-xs flex-1"
                  disabled={adicionandoMarca}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdicionarMarcaPersonalizada();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAdicionarMarcaPersonalizada}
                  disabled={!novaMarcaNome.trim() || adicionandoMarca}
                  className="h-9 text-xs font-semibold gap-1"
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
                    {clienteSelecionado?.representante_prado || representantePrado || 'outro representante'}).
                    <p className="mt-1 text-muted-foreground">
                      Sugerimos ofertar as marcas <strong>Scalla</strong> (esquadrias) ou <strong>Kit Porta (Rohden/Imab)</strong>.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-destructive/20">
                  <Checkbox
                    id="confirmar-prado"
                    checked={confirmouPradoOutroRep}
                    onCheckedChange={(c) => setConfirmouPradoOutroRep(!!c)}
                  />
                  <label
                    htmlFor="confirmar-prado"
                    className="font-medium cursor-pointer text-foreground text-xs"
                  >
                    Estou ciente e desejo manter a marca PRADO selecionada nesta oportunidade.
                  </label>
                </div>
              </div>
            )}

            {/* Situação para cada marca selecionada (exceto PRADO, que usa o campo que já existe) */}
            {marcasSelecionadas.filter((id) => id !== pradoId).length > 0 && (
              <div className="space-y-3 pt-3 border-t border-border/70">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                  Situação comercial das marcas selecionadas
                </label>
                <div className="space-y-2.5">
                  {marcasSelecionadas
                    .filter((id) => id !== pradoId)
                    .map((id) => {
                      const m = marcasLocais.find((item) => item.id === id);
                      const sitObj = situacoesPorMarca[id] || { situacao: 'nao_verificado', representante: '' };
                      return (
                        <div
                          key={id}
                          className="p-3 rounded-lg border border-border bg-accent/20 space-y-2"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="font-semibold text-xs text-foreground shrink-0">
                              {m?.nome || 'Marca'}
                            </span>
                            <select
                              value={sitObj.situacao}
                              onChange={(e) => {
                                const novaSit = e.target.value as SituacaoPrado;
                                setSituacoesPorMarca((prev) => {
                                  const current = prev[id];
                                  return {
                                    ...prev,
                                    [id]: {
                                      situacao: novaSit,
                                      representante: current?.representante,
                                    },
                                  };
                                });
                              }}
                              className="w-full sm:w-64 h-9 px-2.5 rounded-md border border-input bg-card text-xs font-medium"
                            >
                              <option value="nao_verificado">Não verificado</option>
                              <option value="livre">Livre</option>
                              <option value="ja_cliente">Já é cliente</option>
                              <option value="atendida_outro_rep">Atendido por outro representante</option>
                            </select>
                          </div>

                          {sitObj.situacao === 'atendida_outro_rep' && (
                            <div className="pt-1 animate-in fade-in space-y-1">
                              <label className="text-[11px] font-semibold text-destructive block">
                                Nome do representante da {m?.nome}
                              </label>
                              <Input
                                placeholder="Ex: Carlos Silva"
                                value={sitObj.representante || ''}
                                onChange={(e) => {
                                  const repVal = e.target.value;
                                  setSituacoesPorMarca((prev) => {
                                    const current = prev[id];
                                    return {
                                      ...prev,
                                      [id]: {
                                        situacao: current?.situacao || 'nao_verificado',
                                        representante: repVal,
                                      },
                                    };
                                  });
                                }}
                                className="h-8 bg-card text-xs"
                              />
                              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive flex items-center gap-1.5 mt-1">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                  A marca <strong>{m?.nome}</strong> é atendida por outro representante (
                                  {sitObj.representante || 'outro representante'}).
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* 4. Etapa e Descrição */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                Etapa da oportunidade
              </label>
              <select
                value={etapa}
                onChange={(e) => setEtapa(e.target.value as any)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="prospeccao">Prospecção (padrão)</option>
                <option value="orcamento">Orçamento</option>
                <option value="negociacao">Negociação</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
                Descrição / Observações da oportunidade (opcional)
              </label>
              <Textarea
                placeholder="Ex: Empreendimento em fase de projeto executivo, entrega para final do ano."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className="resize-none bg-card"
              />
            </div>
          </div>

          {/* 5. Pergunta: Já enviou a apresentação? */}
          <div className="p-4 rounded-lg border border-border bg-accent/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Já enviou a apresentação para este contato?
                </span>
              </div>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={jaEnviouApresentacao ? 'default' : 'outline'}
                  onClick={() => setJaEnviouApresentacao(true)}
                  className="h-8 text-xs font-semibold px-3"
                >
                  Sim
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!jaEnviouApresentacao ? 'secondary' : 'ghost'}
                  onClick={() => setJaEnviouApresentacao(false)}
                  className="h-8 text-xs px-3"
                >
                  Não
                </Button>
              </div>
            </div>

            {jaEnviouApresentacao && (
              <div className="space-y-2 pt-2 border-t border-border animate-in fade-in">
                <label className="text-xs font-semibold text-muted-foreground block">
                  Canal do envio realizado:
                </label>
                <div className="flex gap-2">
                  {(['whatsapp', 'email', 'ligacao'] as TipoRegistro[]).map((c) => (
                    <Button
                      key={c}
                      type="button"
                      size="sm"
                      variant={canalEnvio === c ? 'default' : 'outline'}
                      onClick={() => setCanalEnvio(c)}
                      className="capitalize text-xs h-9 flex-1"
                    >
                      {c}
                    </Button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  O sistema criará o primeiro registro de envio e agendará o próximo follow-up pela cadência configurada.
                </p>
              </div>
            )}
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
                'Salvando...'
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Salvar Prospect
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
