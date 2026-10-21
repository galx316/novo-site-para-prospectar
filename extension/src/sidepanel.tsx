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

export function SidePanelApp() {
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);
  const [erroAuth, setErroAuth] = useState<string | null>(null);

  const [estadoAba, setEstadoAba] = useState<
    'carregando' | 'nao_whatsapp' | 'precisa_recarregar' | 'sem_conversa' | 'ok'
  >('carregando');
  const [tabWhatsAppId, setTabWhatsAppId] = useState<number | null>(null);

  const [conversa, setConversa] = useState<ConversaInfo | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
  const [erroContato, setErroContato] = useState<string | null>(null);
  const [dadosContato, setDadosContato] = useState<DadosContatoPainel | null>(null);

  const [modalVincularAberto, setModalVincularAberto] = useState(false);
  const [atalhosDias, setAtalhosDias] = useState<number[]>([3, 7, 15, 30]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

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
          }
          if (marcasRes.data) {
            setMarcas(marcasRes.data);
          }
        })(),
        10000,
        'Não foi possível carregar configurações.'
      );
    } catch (e) {
      console.error('Erro ao carregar configurações/marcas:', e);
    }
  }, []);

  // 2. Buscar dados completos do contato no Supabase
  const buscarDadosContato = useCallback(
    async (infoConversa: ConversaInfo, marcasLista: Marca[]) => {
      if (!infoConversa.aberta || infoConversa.erro === 'nao_identificado') {
        setDadosContato(null);
        setCarregandoConversa(false);
        setErroContato(null);
        return;
      }

      setCarregandoConversa(true);
      setErroContato(null);
      try {
        await comTimeout(
          (async () => {
            let contatoObj: any = null;
            let clienteObj: any = null;
            let followupPendenteObj: any = null;
            let oportunidadesList: any[] = [];

            // a) Se houver número, chamar a RPC buscar_contato_por_whatsapp para cada variante
            if (infoConversa.numero) {
              const variantes = variantesNumeroBR(infoConversa.numero);
              for (const varNumero of variantes) {
                const { data: rpcData, error: rpcErr } = await supabase.rpc(
                  'buscar_contato_por_whatsapp',
                  { p_numero: varNumero }
                );

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
              const storageKey = `vinculo_${infoConversa.titulo}`;
              const res = await chrome.storage.local.get(storageKey);
              const contatoIdVinculado = res && res[storageKey];

              if (contatoIdVinculado) {
                const { data: cData } = await supabase
                  .from('contatos')
                  .select('*')
                  .eq('id', contatoIdVinculado)
                  .single();

                if (cData) {
                  contatoObj = cData;

                  // Buscar cliente
                  const { data: cliData } = await supabase
                    .from('clientes')
                    .select('*')
                    .eq('id', cData.cliente_id)
                    .single();
                  clienteObj = cliData;

                  // Buscar follow-up pendente
                  const { data: fuData } = await supabase
                    .from('followups')
                    .select('*')
                    .eq('contato_id', cData.id)
                    .eq('status', 'pendente')
                    .order('data', { ascending: true })
                    .limit(1);
                  followupPendenteObj = fuData?.[0] || null;

                  // Buscar oportunidades do contato
                  const { data: opData } = await supabase
                    .from('oportunidades')
                    .select('*')
                    .eq('contato_id', cData.id);
                  oportunidadesList = opData || [];
                }
              }
            }

            // Se encontrou o contato:
            if (contatoObj && clienteObj) {
              const marcasMap = new Map((marcasLista || []).map((m) => [m.id, m]));

              // Buscar todas as oportunidades abertas da CONSTRUTORA
              const { data: opsCliente } = await supabase
                .from('oportunidades')
                .select('*')
                .eq('cliente_id', clienteObj.id)
                .order('created_at', { ascending: false });

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

              // Buscar último registro de whatsapp enviado para verificar aviso amarelo
              const { data: ultimoEnvioData } = await supabase
                .from('registros')
                .select('*')
                .eq('contato_id', contatoObj.id)
                .eq('tipo', 'whatsapp')
                .eq('direcao', 'enviado')
                .order('created_at', { ascending: false })
                .limit(1);

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

              setDadosContato({
                contato: contatoObj,
                cliente: clienteObj,
                oportunidades: todasOps,
                followup_pendente: followupPendenteObj,
                ultimos_registros: regData || [],
                aviso_resposta_pendente: avisoResposta,
              });
            } else {
              setDadosContato(null);
            }
          })(),
          10000,
          'Não foi possível conectar ao CRM. Verifique a internet.'
        );
      } catch (err: any) {
        console.error('Erro ao buscar dados do contato:', err);
        setErroContato('Não foi possível conectar ao CRM. Verifique a internet.');
        setDadosContato(null);
      } finally {
        setCarregandoConversa(false);
      }
    },
    []
  );

  // 3. Solicitar conversa ativa da aba aberta do WhatsApp
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
          setEstadoAba('ok');
          setConversa(resposta);
          buscarDadosContato(resposta, marcas);
        }
      );
    });
  }, [buscarDadosContato, marcas]);

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
        await carregarMetadados();
        checarAbaWhatsApp();
      }
    } catch (e: any) {
      console.error('Erro na checagem de sessão:', e);
      setErroAuth('Não foi possível conectar ao CRM. Verifique a internet.');
    } finally {
      setVerificandoAuth(false);
    }
  }, [carregarMetadados, checarAbaWhatsApp]);

  useEffect(() => {
    checarSessao();
  }, [checarSessao]);

  // Escutar mudança de aba e recarregamento para sincronizar painel
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
        setConversa(payload);
        if (autorizado) {
          if (!payload.aberta) {
            setEstadoAba('sem_conversa');
            setDadosContato(null);
          } else {
            setEstadoAba('ok');
            buscarDadosContato(payload, marcas);
          }
        }
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [autorizado, buscarDadosContato, marcas]);

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
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
      buscarDadosContato(conversa, marcas);
    }
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
        carregando={carregandoConversa}
      />

      <main className="panel-content">
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
                  buscarDadosContato(conversa, marcas);
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
    </div>
  );
}

// Inicializar aplicação React no root
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SidePanelApp />);
}
