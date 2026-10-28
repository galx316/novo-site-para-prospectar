import React, { useEffect, useState, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';
import type { ConversaInfo, DadosContatoPainel, Marca } from './types';
import { Header } from './components/Header';
import { LoginView } from './components/LoginView';
import { ContatoView } from './components/ContatoView';
import { NaoEncontradoView } from './components/NaoEncontradoView';
import { DialogVincular } from './components/DialogVincular';
import { ToastContainer, showToast } from './components/Toast';
import { comTimeout } from './async-utils';

/**
 * Gera variantes de número brasileiro (com e sem o 9º dígito após o DDD).
 */
export function variantesNumeroBR(numero?: string | null): string[] {
  if (!numero) return [];
  let d = numero.replace(/\D/g, '');
  if (!d) return [numero];

  // Se tiver 10 ou 11 dígitos, coloque "55" na frente
  if (d.length === 10 || d.length === 11) {
    d = '55' + d;
  }

  // Se tiver 13 dígitos, começar com "55" e o 5º dígito (primeiro depois do DDD) for "9":
  // variantes = [o próprio, sem esse 9]
  if (d.length === 13 && d.startsWith('55') && d[4] === '9') {
    return [d, d.slice(0, 4) + d.slice(5)];
  }

  // Se tiver 12 dígitos, começar com "55" e o 5º dígito for 6, 7, 8 ou 9:
  // variantes = [o próprio, com "9" inserido depois do DDD]
  if (
    d.length === 12 &&
    d.startsWith('55') &&
    ['6', '7', '8', '9'].includes(d[4])
  ) {
    return [d, d.slice(0, 4) + '9' + d.slice(4)];
  }

  // Senão: variantes = [o próprio]
  return [d];
}

/**
 * Retorna o número brasileiro com o 9º dígito (para salvar no contato do CRM).
 */
export function obterVarianteComNove(numero?: string | null): string {
  if (!numero) return '';
  let d = numero.replace(/\D/g, '');
  if (!d) return '';

  if (d.length === 10 || d.length === 11) {
    d = '55' + d;
  }

  if (d.length === 12 && d.startsWith('55') && ['6', '7', '8', '9'].includes(d[4])) {
    return d.slice(0, 4) + '9' + d.slice(4);
  }

  return d;
}

/**
 * Formata um número de telefone no padrão legível brasileiro (+55 11 98765-4321).
 */
export function formatarTelefone(numero?: string | null): string {
  if (!numero) return '';
  const d = numero.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
  }
  if (d.length === 12 && d.startsWith('55')) {
    return `+55 ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
  }
  if (d.length === 11) {
    return `+55 ${d.slice(0, 2)} ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `+55 ${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  if (numero.startsWith('+')) return numero;
  return `+${numero}`;
}

/**
 * Cria a chave da conversa para detectar trocas de chat.
 * Título da conversa (+ número, se houver).
 */
export function obterChaveConversa(info?: ConversaInfo | null): string {
  if (!info || !info.aberta || !info.titulo) return '';
  return info.numero ? `${info.titulo}:::${info.numero}` : info.titulo;
}

export function SidePanelApp() {
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [erroAuth, setErroAuth] = useState<string | null>(null);
  const [erroLoop, setErroLoop] = useState<string | null>(null);

  const [estadoAba, setEstadoAba] = useState<
    'carregando' | 'nao_whatsapp' | 'precisa_recarregar' | 'sem_conversa' | 'ok'
  >('carregando');
  const [tabWhatsAppId, setTabWhatsAppId] = useState<number | null>(null);

  const [conversa, setConversa] = useState<ConversaInfo | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [dadosContato, setDadosContato] = useState<DadosContatoPainel | null>(null);

  const [modalVincularAberto, setModalVincularAberto] = useState(false);
  const [modalOpcoesAberto, setModalOpcoesAberto] = useState(false);
  const [numeroSalvoNoCache, setNumeroSalvoNoCache] = useState<string | null>(null);
  const [vinculoSalvoNoCache, setVinculoSalvoNoCache] = useState<string | null>(null);
  const [numerosDescartados, setNumerosDescartados] = useState<Set<string>>(new Set());
  const [atalhosDias, setAtalhosDias] = useState<number[]>([3, 7, 15, 30]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  // Referências para controle de concorrência e chave da conversa
  const chaveConversaRef = useRef<string>('');
  const chaveConversaExibidaRef = useRef<string>('');
  const contadorBuscaRef = useRef<number>(0);

  // Referências para evitar dependências instáveis e re-renders em cascata
  const marcasRef = useRef<Marca[]>([]);
  marcasRef.current = marcas;

  const atalhosDiasRef = useRef<number[]>([3, 7, 15, 30]);
  atalhosDiasRef.current = atalhosDias;

  const metadadosCarregadosRef = useRef(false);
  const chamadasAuthorizedRef = useRef<number[]>([]);

  // Referência para evitar concorrência de requisições de conversa
  const conversaAtualRef = useRef<ConversaInfo | null>(null);
  conversaAtualRef.current = conversa;

  // 1. Carregar metadados (configurações e marcas)
  const carregarMetadados = useCallback(async () => {
    try {
      await comTimeout(
        (async () => {
          const [confRes, marcasRes] = await Promise.all([
            supabase.from('configuracoes').select('atalhos_dias').eq('id', 1).single(),
            supabase.from('marcas').select('*').order('nome'),
          ]);

          if (confRes.data?.atalhos_dias) {
            setAtalhosDias(confRes.data.atalhos_dias);
            atalhosDiasRef.current = confRes.data.atalhos_dias;
          }
          if (marcasRes.data) {
            setMarcas(marcasRes.data);
            marcasRef.current = marcasRes.data;
          }
        })(),
        10000,
        'Não foi possível carregar configurações.'
      );
    } catch (e) {
      console.error('Erro ao carregar configurações/marcas:', e);
    }
  }, []);

  // 2. Buscar dados completos do contato no Supabase (não depende de marcas)
  const buscarDadosContato = useCallback(
    async (infoConversa: ConversaInfo) => {
      const idChamada = ++contadorBuscaRef.current;

      const chaveDestaBusca = obterChaveConversa(infoConversa);
      if (chaveDestaBusca !== chaveConversaRef.current) {
        chaveConversaRef.current = chaveDestaBusca;
        if (idChamada === contadorBuscaRef.current) {
          setDadosContato(null);
          if (chaveDestaBusca) {
            setCarregandoConversa(true);
          }
        }
      }

      if (!infoConversa.aberta || infoConversa.erro === 'nao_identificado') {
        if (idChamada === contadorBuscaRef.current) {
          setDadosContato(null);
          setCarregandoConversa(false);
          setErroContato(null);
        }
        return;
      }

      if (idChamada === contadorBuscaRef.current) {
        setCarregandoConversa(true);
        setErroContato(null);
      }

      try {
        await comTimeout(
          (async () => {
            let contatoObj: any = null;
            let clienteObj: any = null;
            let followupPendenteObj: any = null;
            let oportunidadesList: any[] = [];

            // Se não houver número no payload mas houver título, tentar buscar número salvo no storage
            let numeroConsulta = infoConversa.numero;
            if (!numeroConsulta && infoConversa.titulo) {
              try {
                const storageKeyNum = `numero_${infoConversa.titulo}`;
                const resNum = await chrome.storage.local.get(storageKeyNum);
                if (idChamada !== contadorBuscaRef.current) return;
                if (resNum && resNum[storageKeyNum]) {
                  numeroConsulta = String(resNum[storageKeyNum]);
                  infoConversa.numero = numeroConsulta;
                  infoConversa.origemNumero = 'dados_contato';
                  chaveConversaRef.current = obterChaveConversa(infoConversa);
                  setConversa((prev) => (prev ? { ...prev, numero: numeroConsulta, origemNumero: 'dados_contato' } : prev));
                }
              } catch {}
            }

            if (idChamada !== contadorBuscaRef.current) return;

            // Ignorar números descartados pelo usuário nesta conversa
            if (
              infoConversa.titulo &&
              numeroConsulta &&
              numerosDescartados.has(`${infoConversa.titulo}_${numeroConsulta}`)
            ) {
              numeroConsulta = null;
              infoConversa.numero = null;
              infoConversa.origemNumero = null;
            }

            // a) Se houver número, chamar a RPC buscar_contato_por_whatsapp para cada variante
            if (numeroConsulta) {
              const variantes = variantesNumeroBR(numeroConsulta);
              for (const varNumero of variantes) {
                if (idChamada !== contadorBuscaRef.current) return;
                const { data: rpcData, error: rpcErr } = await supabase.rpc(
                  'buscar_contato_por_whatsapp',
                  { p_numero: varNumero }
                );

                if (idChamada !== contadorBuscaRef.current) return;

                if (!rpcErr && rpcData && typeof rpcData === 'object') {
                  const parsed = rpcData as any;
                  if (parsed.contato) {
                    contatoObj = parsed.contato;
                    clienteObj = parsed.cliente;
                    followupPendenteObj = parsed.followup_pendente;
                    oportunidadesList = parsed.oportunidades || [];
                    break;
                  }
                }
              }
            }

            // b) Se não houver número ou não achar: procurar em chrome.storage.local vínculo "título → contato_id"
            if (!contatoObj && infoConversa.titulo) {
              if (idChamada !== contadorBuscaRef.current) return;
              const storageKey = `vinculo_${infoConversa.titulo}`;
              const res = await chrome.storage.local.get(storageKey);
              if (idChamada !== contadorBuscaRef.current) return;
              const contatoIdVinculado = res && res[storageKey];

              if (contatoIdVinculado) {
                const { data: cData } = await supabase
                  .from('contatos')
                  .select('*')
                  .eq('id', contatoIdVinculado)
                  .single();

                if (idChamada !== contadorBuscaRef.current) return;

                if (cData) {
                  contatoObj = cData;

                  // Buscar cliente
                  const { data: cliData } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', cData.cliente_id)
                    .single();
                  if (idChamada !== contadorBuscaRef.current) return;
                  clienteObj = cliData;

                  // Buscar follow-up pendente
                  const { data: fuData } = await supabase
                    .from('followups')
                    .select('*')
                    .eq('contato_id', cData.id)
                    .eq('status', 'pendente')
                    .order('data', { ascending: true })
                    .limit(1);
                  if (idChamada !== contadorBuscaRef.current) return;
                  followupPendenteObj = fuData?.[0] || null;

                  // Buscar oportunidades do contato
                  const { data: opData } = await supabase
                    .from('oportunidades')
                    .select('*')
                    .eq('contato_id', cData.id);
                  if (idChamada !== contadorBuscaRef.current) return;
                  oportunidadesList = opData || [];
                }
              }
            }

            if (idChamada !== contadorBuscaRef.current) return;

            // Se encontrou o contato:
            if (contatoObj && clienteObj) {
              const marcasLista = marcasRef.current;
              const marcasMap = new Map((marcasLista || []).map((m) => [m.id, m]));

              // Buscar todas as oportunidades abertas da CONSTRUTORA
              const { data: opsCliente } = await supabase
                .from('oportunidades')
                .select('*')
                .eq('cliente_id', clienteObj.id)
                .order('created_at', { ascending: false });

              if (idChamada !== contadorBuscaRef.current) return;

              const todasOps = (opsCliente || oportunidadesList || []).map((op: any) => ({
                ...op,
                marcas: (op.marca_ids || []).map((id: string) => marcasMap.get(id)).filter(Boolean),
              }));

              // Buscar últimos 5 registros do contato
              const { data: regData } = await supabase
                .from('registros')
                .select('*')
                .eq('contato_id', contatoObj.id)
                .order('data', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5);

              if (idChamada !== contadorBuscaRef.current) return;

              // Buscar último registro de whatsapp enviado para verificar aviso amarelo
              const { data: ultimoEnvioData } = await supabase
                .from('registros')
                .select('*')
                .eq('contato_id', contatoObj.id)
                .eq('tipo', 'whatsapp')
                .eq('direcao', 'enviado')
                .order('created_at', { ascending: false })
                .limit(1);

              if (idChamada !== contadorBuscaRef.current) return;

              const ultimoEnvio = ultimoEnvioData?.[0] || null;

              // Verificar aviso amarelo: "Chegou resposta depois do seu último envio"
              let avisoResposta = false;
              if (infoConversa.ultimaMensagem?.direcao === 'recebida' && ultimoEnvio) {
                const envioTimestamp = new Date(ultimoEnvio.created_at || ultimoEnvio.data).getTime();
                if (infoConversa.ultimaMensagem.timestamp) {
                  avisoResposta = infoConversa.ultimaMensagem.timestamp > envioTimestamp;
                } else {
                  avisoResposta = true;
                }
              }

              if (idChamada === contadorBuscaRef.current) {
                chaveConversaExibidaRef.current = obterChaveConversa(infoConversa);
                setDadosContato({
                  contato: contatoObj,
                  cliente: clienteObj,
                  oportunidades: todasOps,
                  followup_pendente: followupPendenteObj,
                  ultimos_registros: regData || [],
                  aviso_resposta_pendente: avisoResposta,
                });
              }
            } else {
              if (idChamada === contadorBuscaRef.current) {
                chaveConversaExibidaRef.current = obterChaveConversa(infoConversa);
                setDadosContato(null);
              }
            }
          })(),
          10000,
          'Não foi possível conectar ao CRM. Verifique a internet.'
        );
      } catch (err: any) {
        if (idChamada === contadorBuscaRef.current) {
          console.error('Erro ao buscar dados do contato:', err);
          setErroContato('Não foi possível conectar ao CRM. Verifique a internet.');
          setDadosContato(null);
        }
      } finally {
        if (idChamada === contadorBuscaRef.current) {
          setCarregandoConversa(false);
        }
      }
    },
    [numerosDescartados]
  );

  // 3. Solicitar conversa ativa da aba aberta do WhatsApp (deps estáveis)
  const checarAbaWhatsApp = useCallback(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];

      // a) Se a aba ativa não for web.whatsapp.com: mostre "Abra o WhatsApp Web nesta janela."
      if (!activeTab || !activeTab.url || !activeTab.url.includes('web.whatsapp.com')) {
        setEstadoAba('nao_whatsapp');
        setTabWhatsAppId(null);
        setConversa(null);
        setDadosContato(null);
        setErroContato(null);
        return;
      }

      const tabId = activeTab.id;
      setTabWhatsAppId(tabId ?? null);

      if (!tabId) {
        setEstadoAba('nao_whatsapp');
        setConversa(null);
        setDadosContato(null);
        setErroContato(null);
        return;
      }

      chrome.tabs.sendMessage(
        tabId,
        { type: 'GET_CONVERSA_ATUAL' },
        (resposta: ConversaInfo | undefined) => {
          // b) Se sendMessage der chrome.runtime.lastError: mostre "Recarregue a página do WhatsApp Web (F5) para ativar o painel." com o botão "Recarregar WhatsApp"
          if (chrome.runtime.lastError) {
            setEstadoAba('precisa_recarregar');
            setConversa(null);
            setDadosContato(null);
            setErroContato(null);
            return;
          }

          // c) Se a resposta vier com aberta = false: mostre "Abra uma conversa no WhatsApp."
          if (!resposta || !resposta.aberta) {
            setEstadoAba('sem_conversa');
            setConversa(resposta || { aberta: false });
            setDadosContato(null);
            setErroContato(null);
            return;
          }

          // Conversa aberta
          const novaChave = obterChaveConversa(resposta);
          if (novaChave !== chaveConversaRef.current) {
            chaveConversaRef.current = novaChave;
            chaveConversaExibidaRef.current = '';
            setDadosContato(null);
            if (novaChave) {
              setCarregandoConversa(true);
            }
          }
          setEstadoAba('ok');
          setConversa(resposta);
          buscarDadosContato(resposta);
        }
      );
    });
  }, [buscarDadosContato]);

  // Recarregar aba do WhatsApp exclusivamente sob clique do usuário
  function handleRecarregarWhatsApp() {
    if (tabWhatsAppId) {
      chrome.tabs.reload(tabWhatsAppId);
    }
  }

  // 4. Validar autenticação e autorização com tempo limite de 10 segundos
  const checarSessao = useCallback(async () => {
    setVerificandoAuth(true);
    setErroAuth(null);
    try {
      const sessionResult = await comTimeout(
        supabase.auth.getSession(),
        10000,
        'Não foi possível conectar ao CRM. Verifique a internet.'
      );

      const session = sessionResult.data?.session;

      if (!session) {
        setUsuarioEmail(null);
        setAutorizado(null);
        return;
      }

      setUsuarioEmail(session.user?.email || null);

      // Trava contra laço: se chamado mais de 3 vezes em 10 segundos, para e avisa o usuário
      const agora = Date.now();
      const recentes = chamadasAuthorizedRef.current.filter((t) => agora - t < 10000);
      if (recentes.length >= 3) {
        console.error('Proteção contra laço acionada: is_authorized chamado mais de 3 vezes em 10s');
        setErroLoop('Erro interno: muitas verificações. Feche e abra o painel.');
        return;
      }
      chamadasAuthorizedRef.current = [...recentes, agora];

      // Chamar RPC is_authorized com limite de 10s
      const rpcResult = await comTimeout(
        supabase.rpc('is_authorized'),
        10000,
        'Não foi possível conectar ao CRM. Verifique a internet.'
      );

      const { data: aut, error: rpcErr } = rpcResult;
      if (rpcErr || !aut) {
        setAutorizado(false);
      } else {
        setAutorizado(true);
      }
    } catch (e: any) {
      console.error('Erro na checagem de sessão:', e);
      setErroAuth('Não foi possível conectar ao CRM. Verifique a internet.');
    } finally {
      setVerificandoAuth(false);
    }
  }, []);

  // 1. checarSessao roda UMA vez ao abrir o painel
  useEffect(() => {
    checarSessao();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. carregarMetadados roda uma vez, depois que autorizado vira true.
  // 4. checarAbaWhatsApp roda quando autorizado vira true.
  useEffect(() => {
    if (autorizado) {
      if (!metadadosCarregadosRef.current) {
        metadadosCarregadosRef.current = true;
        carregarMetadados();
      }
      checarAbaWhatsApp();
    }
  }, [autorizado, carregarMetadados, checarAbaWhatsApp]);

  // 4. checarAbaWhatsApp roda nos eventos chrome.tabs.onActivated / onUpdated (status 'complete')
  useEffect(() => {
    if (!autorizado) return;

    const handleActivated = () => {
      checarAbaWhatsApp();
    };

    const handleUpdated = (_tabId: number, changeInfo: { status?: string }) => {
      if (changeInfo.status === 'complete') {
        checarAbaWhatsApp();
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, [autorizado, checarAbaWhatsApp]);

  // 5. Escutar mensagens vindas do content script
  useEffect(() => {
    const listener = (mensagem: any) => {
      if (mensagem?.type === 'CONVERSA_ATUALIZADA' && mensagem.payload) {
        const payload: ConversaInfo = mensagem.payload;
        const novaChave = obterChaveConversa(payload);
        if (novaChave !== chaveConversaRef.current) {
          chaveConversaRef.current = novaChave;
          chaveConversaExibidaRef.current = '';
          setDadosContato(null);
          if (novaChave) {
            setCarregandoConversa(true);
          }
        }
        setConversa(payload);
        if (autorizado) {
          if (!payload.aberta) {
            setEstadoAba('sem_conversa');
            setDadosContato(null);
          } else {
            setEstadoAba('ok');
            buscarDadosContato(payload);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [autorizado, buscarDadosContato]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      metadadosCarregadosRef.current = false;
      setUsuarioEmail(null);
      setAutorizado(null);
      setDadosContato(null);
      setConversa(null);
      showToast('Sessão encerrada.');
    } catch (e: any) {
      showToast(e?.message || 'Erro ao deslogar.', 'erro');
    }
  }

  function handleRecarregar() {
    checarAbaWhatsApp();
    if (conversa && estadoAba === 'ok') {
      buscarDadosContato(conversa);
    }
  }

  // Sincronizar cache salvo da conversa aberta
  useEffect(() => {
    if (!conversa?.titulo) {
      setNumeroSalvoNoCache(null);
      setVinculoSalvoNoCache(null);
      return;
    }
    const kNum = `numero_${conversa.titulo}`;
    const kVin = `vinculo_${conversa.titulo}`;
    chrome.storage.local.get([kNum, kVin], (res) => {
      setNumeroSalvoNoCache(res?.[kNum] ? String(res[kNum]) : null);
      setVinculoSalvoNoCache(res?.[kVin] ? String(res[kVin]) : null);
    });

    function handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, area: string) {
      if (area === 'local' && conversa?.titulo) {
        const kNum = `numero_${conversa.titulo}`;
        const kVin = `vinculo_${conversa.titulo}`;
        if (kNum in changes) {
          setNumeroSalvoNoCache(changes[kNum]?.newValue ? String(changes[kNum].newValue) : null);
        }
        if (kVin in changes) {
          setVinculoSalvoNoCache(changes[kVin]?.newValue ? String(changes[kVin].newValue) : null);
        }
      }
    }
    chrome.storage.onChanged.addListener(handleStorageChanged);
    return () => chrome.storage.onChanged.removeListener(handleStorageChanged);
  }, [conversa?.titulo]);

  const chaveDescarteAtual =
    conversa?.titulo && conversa?.numero ? `${conversa.titulo}_${conversa.numero}` : '';

  const precisaConfirmarNumero = !!(
    conversa?.aberta &&
    conversa?.titulo &&
    conversa?.numero &&
    conversa?.origemNumero === 'dados_contato' &&
    !numeroSalvoNoCache &&
    !numerosDescartados.has(chaveDescarteAtual)
  );

  async function handleConfirmarNumeroLido() {
    if (!conversa?.titulo || !conversa?.numero) return;
    const chave = `numero_${conversa.titulo}`;
    try {
      await chrome.storage.local.set({ [chave]: conversa.numero });
      setNumeroSalvoNoCache(conversa.numero);
      showToast(`Número ${formatarTelefone(conversa.numero)} confirmado e salvo para esta conversa!`, 'sucesso');
    } catch (err: any) {
      showToast('Erro ao salvar número.', 'erro');
    }
  }

  function handleDescartarNumeroLido() {
    if (!conversa?.titulo || !conversa?.numero) return;
    const chaveDescarte = `${conversa.titulo}_${conversa.numero}`;
    setNumerosDescartados((prev) => new Set(prev).add(chaveDescarte));
    const novaConversa: ConversaInfo = { ...conversa, numero: null, origemNumero: null };
    setConversa(novaConversa);
    buscarDadosContato(novaConversa);
    showToast('Número descartado.', 'info');
  }

  const validarConversaAtual = useCallback((): boolean => {
    const chaveAtual = chaveConversaRef.current;
    const chaveExibida = chaveConversaExibidaRef.current;
    if (!chaveAtual || !chaveExibida || chaveAtual !== chaveExibida) {
      showToast('A conversa mudou. Atualizando…', 'aviso');
      handleRecarregar();
      return false;
    }
    return true;
  }, []);

  const handleNaoEEsteContato = useCallback(async () => {
    if (!conversa?.titulo) return;
    const tit = conversa.titulo;
    const chaveNum = `numero_${tit}`;
    const chaveVinculo = `vinculo_${tit}`;
    try {
      await chrome.storage.local.remove([chaveNum, chaveVinculo]);
      if (conversa.numero) {
        const chaveDescarte = `${tit}_${conversa.numero}`;
        setNumerosDescartados((prev) => new Set(prev).add(chaveDescarte));
      }
      setNumeroSalvoNoCache(null);
      setVinculoSalvoNoCache(null);
      setDadosContato(null);
      const novaConversa: ConversaInfo = { ...conversa, numero: null, origemNumero: null };
      chaveConversaRef.current = obterChaveConversa(novaConversa);
      chaveConversaExibidaRef.current = '';
      setConversa(novaConversa);
      showToast('Contato desvinculado desta conversa.', 'info');
      buscarDadosContato(novaConversa);
    } catch (err: any) {
      showToast('Erro ao desvincular dados da conversa.', 'erro');
    }
  }, [conversa, buscarDadosContato]);

  async function handleEsquecerNumeroDestaConversa() {
    if (!conversa?.titulo) return;
    const chaveNum = `numero_${conversa.titulo}`;
    const chaveVinculo = `vinculo_${conversa.titulo}`;
    try {
      await chrome.storage.local.remove([chaveNum, chaveVinculo]);
      setNumeroSalvoNoCache(null);
      setVinculoSalvoNoCache(null);
      setModalOpcoesAberto(false);
      showToast(`Número e vínculo de "${conversa.titulo}" foram apagados.`, 'sucesso');
      const novaConversa: ConversaInfo = { ...conversa, numero: null, origemNumero: null };
      setConversa(novaConversa);
      buscarDadosContato(novaConversa);
    } catch (err: any) {
      showToast('Erro ao esquecer dados da conversa.', 'erro');
    }
  }

  // Trava de segurança contra laço infinito
  if (erroLoop) {
    return (
      <div className="panel-app">
        <ToastContainer />
        <div className="panel-loading-container" style={{ minHeight: '100vh', justifyContent: 'center' }}>
          <div
            className="alert-box alert-error"
            style={{
              textAlign: 'center',
              width: '100%',
              maxWidth: '300px',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>🛑</span>
            <p style={{ margin: 0, fontWeight: 600 }}>{erroLoop}</p>
          </div>
        </div>
      </div>
    );
  }

  // Visualização de Carregamento Inicial
  if (verificandoAuth) {
    return (
      <div className="panel-loading-container">
        <div className="brand-logo spinning">G</div>
        <p>Carregando GAL Gestão...</p>
      </div>
    );
  }

  // Erro de Conexão na Autenticação (Timeout ou Falha de Rede)
  if (erroAuth) {
    return (
      <div className="panel-app">
        <ToastContainer />
        <div className="panel-loading-container" style={{ minHeight: '100vh', justifyContent: 'center' }}>
          <div
            className="alert-box alert-error"
            style={{
              textAlign: 'center',
              width: '100%',
              maxWidth: '300px',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span style={{ fontSize: '24px' }}>⚠️</span>
            <p style={{ margin: 0, fontWeight: 500 }}>{erroAuth}</p>
          </div>
          <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => checarSessao()}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  // Visualização de Login
  if (!usuarioEmail || autorizado === null) {
    return (
      <div className="panel-app">
        <ToastContainer />
        <LoginView onSuccess={checarSessao} />
      </div>
    );
  }

  // Usuário não autorizado pela RPC is_authorized
  if (autorizado === false) {
    return (
      <div className="panel-app">
        <ToastContainer />
        <Header emailUsuario={usuarioEmail} onRefresh={checarSessao} onLogout={handleLogout} />
        <div className="nao-autorizado-container">
          <div className="alert-box alert-error">
            <strong>E-mail não autorizado.</strong>
            <p>O e-mail {usuarioEmail} não possui permissão de acesso ao GAL Gestão.</p>
          </div>
          <button className="btn-secondary btn-block mt-4" onClick={handleLogout}>
            Entrar com outro e-mail
          </button>
        </div>
      </div>
    );
  }

  // Painel Principal Autenticado
  return (
    <div className="panel-app">
      <ToastContainer />
      <Header
        emailUsuario={usuarioEmail}
        onRefresh={handleRecarregar}
        onLogout={handleLogout}
        onAbrirOpcoes={() => setModalOpcoesAberto(true)}
        carregando={carregandoConversa}
      />

      {/* Topo do painel: Conversa ativa para conferência do usuário */}
      {conversa?.aberta && conversa?.titulo && (
        <div className="barra-topo-conversa">
          <div className="barra-topo-conversa-conteudo">
            <span className="barra-topo-rotulo">Conversa:</span>
            <span className="barra-topo-titulo" title={conversa.titulo}>
              {conversa.titulo}
            </span>
            {conversa.numero && (
              <span className="barra-topo-numero">
                ({formatarTelefone(conversa.numero)})
              </span>
            )}
          </div>
        </div>
      )}

      <main className="panel-content">
        {/* Banner de confirmação de número lido nos Dados do contato */}
        {precisaConfirmarNumero && (
          <div className="banner-confirmar-numero">
            <div className="banner-confirmar-info">
              <span className="banner-confirmar-icon">📱</span>
              <span className="banner-confirmar-texto">
                Número lido: <strong>{formatarTelefone(conversa.numero)}</strong> — Confirmar
              </span>
            </div>
            <div className="banner-confirmar-acoes">
              <button
                type="button"
                className="btn-confirmar-num"
                onClick={handleConfirmarNumeroLido}
              >
                Confirmar
              </button>
              <button
                type="button"
                className="btn-descartar-num"
                onClick={handleDescartarNumeroLido}
              >
                Não é este
              </button>
            </div>
          </div>
        )}
        {/* Caso 1: Aba ativa não é web.whatsapp.com */}
        {estadoAba === 'nao_whatsapp' && (
          <div className="estado-vazio">
            <div className="icone-vazio">🌐</div>
            <h3>WhatsApp Web não detectado</h3>
            <p>Abra o WhatsApp Web nesta janela.</p>
            <button className="btn-secondary btn-sm mt-3" onClick={checarAbaWhatsApp}>
              Verificar agora
            </button>
          </div>
        )}

        {/* Caso 2: sendMessage deu lastError -> precisa recarregar WhatsApp */}
        {estadoAba === 'precisa_recarregar' && (
          <div className="estado-vazio">
            <div className="icone-vazio">🔄</div>
            <h3>Ativação necessária</h3>
            <p>Recarregue a página do WhatsApp Web (F5) para ativar o painel.</p>
            <button
              className="btn-primary btn-sm mt-3"
              onClick={handleRecarregarWhatsApp}
            >
              Recarregar WhatsApp
            </button>
          </div>
        )}

        {/* Caso 3: WhatsApp aberto, mas resposta com aberta = false */}
        {estadoAba === 'sem_conversa' && (
          <div className="estado-vazio">
            <div className="icone-vazio">💬</div>
            <h3>Nenhuma conversa aberta</h3>
            <p>Abra uma conversa no WhatsApp.</p>
            <button className="btn-secondary btn-sm mt-3" onClick={checarAbaWhatsApp}>
              Verificar agora
            </button>
          </div>
        )}

        {/* Caso 4: Verificando WhatsApp Web pela primeira vez */}
        {estadoAba === 'carregando' && (
          <div className="panel-loading-container" style={{ padding: '40px 16px' }}>
            <div className="brand-logo spinning">G</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Verificando WhatsApp Web...</p>
          </div>
        )}

        {/* Caso 5: Erro de leitura do seletor */}
        {estadoAba === 'ok' && conversa?.erro === 'nao_identificado' && (
          <div className="estado-erro-leitura">
            <div className="alert-box alert-warning">
              <span className="alert-icon">⚠️</span>
              <div>
                <strong>Não foi possível ler a conversa.</strong>
                <p>O WhatsApp pode ter atualizado o layout. Use o botão Vincular abaixo.</p>
              </div>
            </div>
            <button
              className="btn-primary btn-block mt-4"
              onClick={() => setModalVincularAberto(true)}
            >
              Vincular a contato existente
            </button>
          </div>
        )}

        {/* Caso 6: Erro ao carregar dados do contato (timeout ou rede) */}
        {estadoAba === 'ok' && erroContato && (
          <div className="estado-vazio">
            <div
              className="alert-box alert-error"
              style={{
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                width: '100%',
              }}
            >
              <span style={{ fontSize: '24px' }}>⚠️</span>
              <p style={{ margin: 0, fontWeight: 500 }}>{erroContato}</p>
            </div>
            <button
              className="btn-primary btn-sm mt-3"
              onClick={() => {
                if (conversa) {
                  buscarDadosContato(conversa);
                } else {
                  checarAbaWhatsApp();
                }
              }}
            >
              Tentar de novo
            </button>
          </div>
        )}

        {/* Caso 7: Carregando dados do contato */}
        {estadoAba === 'ok' && carregandoConversa && !erroContato && (
          <div className="panel-loading-container" style={{ padding: '40px 16px' }}>
            <div className="brand-logo spinning">G</div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Carregando dados do prospect...</p>
          </div>
        )}

        {/* Caso 8: Conversa aberta e contato encontrado */}
        {estadoAba === 'ok' && !carregandoConversa && !erroContato && conversa?.aberta && dadosContato && (
          <ContatoView
            dados={dadosContato}
            conversa={conversa}
            atalhosDias={atalhosDias}
            onAtualizar={handleRecarregar}
            onNaoEEsteContato={handleNaoEEsteContato}
            onValidarConversa={validarConversaAtual}
          />
        )}

        {/* Caso 9: Conversa aberta mas contato NÃO encontrado */}
        {estadoAba === 'ok' &&
          !carregandoConversa &&
          !erroContato &&
          conversa?.aberta &&
          !dadosContato &&
          conversa?.erro !== 'nao_identificado' && (
            <NaoEncontradoView
              conversa={conversa}
              onAbrirVincular={() => setModalVincularAberto(true)}
            />
          )}

        {/* Rodapé com link para opções do painel / conversa */}
        {estadoAba === 'ok' && conversa?.aberta && conversa?.titulo && (
          <div className="painel-rodape-opcoes">
            <button
              type="button"
              className="btn-link-opcoes"
              onClick={() => setModalOpcoesAberto(true)}
            >
              ⚙ Opções do painel / Esquecer número
            </button>
          </div>
        )}
      </main>

      {/* Modal Vincular */}
      {modalVincularAberto && conversa && (
        <DialogVincular
          tituloConversa={conversa.titulo || 'Conversa'}
          numeroConversa={
            conversa.numero
              ? (variantesNumeroBR(conversa.numero).find((v) => v.length === 13) || conversa.numero)
              : null
          }
          onClose={() => setModalVincularAberto(false)}
          onSuccess={() => {
            setModalVincularAberto(false);
            handleRecarregar();
          }}
        />
      )}

      {/* Modal de Opções do Painel */}
      {modalOpcoesAberto && (
        <div className="modal-backdrop" onClick={() => setModalOpcoesAberto(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Opções do Painel</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setModalOpcoesAberto(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: '14px' }}>
              <div className="opcoes-section">
                <span className="opcoes-section-title">Conversa Aberta</span>
                {conversa?.aberta && conversa?.titulo ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <div className="opcoes-item">
                      <span style={{ fontWeight: 600 }}>{conversa.titulo}</span>
                    </div>

                    <div className="opcoes-sub">
                      {numeroSalvoNoCache ? (
                        <span>Número em cache: <strong>{formatarTelefone(numeroSalvoNoCache)}</strong></span>
                      ) : (
                        <span>Nenhum número em cache</span>
                      )}
                    </div>

                    {vinculoSalvoNoCache && (
                      <div className="opcoes-sub">
                        <span>Vínculo manual no CRM: <strong>Ativo</strong></span>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-danger btn-block mt-2"
                      onClick={handleEsquecerNumeroDestaConversa}
                    >
                      Esquecer número desta conversa
                    </button>
                    <span className="field-hint" style={{ fontSize: '10.5px', marginTop: '2px' }}>
                      Apaga o número em cache (numero_{conversa.titulo}) e o vínculo manual (vinculo_{conversa.titulo}) salvos para esta conversa.
                    </span>
                  </div>
                ) : (
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Nenhuma conversa do WhatsApp aberta no momento.
                  </p>
                )}
              </div>

              <div className="opcoes-section">
                <span className="opcoes-section-title">Configurações Gerais</span>
                <button
                  type="button"
                  className="btn-secondary btn-block mt-2"
                  onClick={() => {
                    setModalOpcoesAberto(false);
                    if (chrome.runtime.openOptionsPage) {
                      chrome.runtime.openOptionsPage();
                    } else {
                      window.open(chrome.runtime.getURL('options.html'));
                    }
                  }}
                >
                  Abrir configurações avançadas (URL do CRM) ↗
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inicializar aplicação React no root
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SidePanelApp />);
}
