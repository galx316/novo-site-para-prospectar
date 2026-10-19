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

export function SidePanelApp() {
  const [verificandoAuth, setVerificandoAuth] = useState(true);
  const [usuarioEmail, setUsuarioEmail] = useState<string | null>(null);
  const [autorizado, setAutorizado] = useState<boolean | null>(null);

  const [conversa, setConversa] = useState<ConversaInfo | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState(false);
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
    } catch (e) {
      console.error('Erro ao carregar configurações/marcas:', e);
    }
  }, []);

  // 2. Buscar dados completos do contato no Supabase
  const buscarDadosContato = useCallback(
    async (infoConversa: ConversaInfo, marcasLista: Marca[]) => {
      if (!infoConversa.aberta || infoConversa.erro === 'nao_identificado') {
        setDadosContato(null);
        return;
      }

      setCarregandoConversa(true);
      try {
        let contatoObj: any = null;
        let clienteObj: any = null;
        let followupPendenteObj: any = null;
        let oportunidadesList: any[] = [];

        // a) Se houver número, chamar a RPC buscar_contato_por_whatsapp
        if (infoConversa.numero) {
          const { data: rpcData, error: rpcErr } = await supabase.rpc(
            'buscar_contato_por_whatsapp',
            { p_numero: infoConversa.numero }
          );

          if (!rpcErr && rpcData && typeof rpcData === 'object') {
            const parsed = rpcData as any;
            contatoObj = parsed.contato;
            clienteObj = parsed.cliente;
            followupPendenteObj = parsed.followup_pendente;
            oportunidadesList = parsed.oportunidades || [];
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
          // quando a última mensagem da conversa for recebida e o horário dela for depois do último registro enviado
          let avisoResposta = false;
          if (infoConversa.ultimaMensagem?.direcao === 'recebida' && ultimoEnvio) {
            const envioTimestamp = new Date(ultimoEnvio.created_at || ultimoEnvio.data).getTime();
            if (infoConversa.ultimaMensagem.timestamp) {
              avisoResposta = infoConversa.ultimaMensagem.timestamp > envioTimestamp;
            } else {
              // Se não tiver timestamp exato, como a última foi recebida e há envio registrado anterior
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
      } catch (err) {
        console.error('Erro ao buscar dados do contato:', err);
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
      if (activeTab && activeTab.id && activeTab.url && activeTab.url.includes('web.whatsapp.com')) {
        chrome.tabs.sendMessage(
          activeTab.id,
          { type: 'GET_CONVERSA_ATUAL' },
          (resposta: ConversaInfo | undefined) => {
            if (chrome.runtime.lastError) {
              // Content script ainda não carregado ou sem foco
              return;
            }
            if (resposta) {
              setConversa(resposta);
              buscarDadosContato(resposta, marcas);
            }
          }
        );
      }
    });
  }, [buscarDadosContato, marcas]);

  // 4. Validar autenticação e autorização
  const checarSessao = useCallback(async () => {
    setVerificandoAuth(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setUsuarioEmail(null);
        setAutorizado(null);
        setVerificandoAuth(false);
        return;
      }

      setUsuarioEmail(session.user?.email || null);

      // Chamar RPC is_authorized
      const { data: aut, error: rpcErr } = await supabase.rpc('is_authorized');
      if (rpcErr || !aut) {
        setAutorizado(false);
      } else {
        setAutorizado(true);
        await carregarMetadados();
        checarAbaWhatsApp();
      }
    } catch (e) {
      console.error('Erro na checagem de sessão:', e);
      setAutorizado(false);
    } finally {
      setVerificandoAuth(false);
    }
  }, [carregarMetadados, checarAbaWhatsApp]);

  useEffect(() => {
    checarSessao();
  }, [checarSessao]);

  // 5. Escutar mensagens vindas do content script
  useEffect(() => {
    const listener = (mensagem: any) => {
      if (mensagem?.type === 'CONVERSA_ATUALIZADA' && mensagem.payload) {
        const payload: ConversaInfo = mensagem.payload;
        setConversa(payload);
        if (autorizado) {
          buscarDadosContato(payload, marcas);
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
    if (conversa) {
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
        {/* Caso A: Erro de leitura do seletor */}
        {conversa?.erro === 'nao_identificado' && (
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

        {/* Caso B: Nenhuma conversa aberta no WhatsApp */}
        {(!conversa || !conversa.aberta) && conversa?.erro !== 'nao_identificado' && (
          <div className="estado-vazio">
            <div className="icone-vazio">💬</div>
            <h3>Nenhuma conversa aberta</h3>
            <p>Abra uma conversa no WhatsApp Web para visualizar o prospect correspondente.</p>
            <button className="btn-secondary btn-sm mt-3" onClick={checarAbaWhatsApp}>
              Verificar agora
            </button>
          </div>
        )}

        {/* Caso C: Conversa aberta e contato encontrado */}
        {conversa?.aberta && dadosContato && (
          <ContatoView
            dados={dadosContato}
            conversa={conversa}
            atalhosDias={atalhosDias}
            onAtualizar={handleRecarregar}
          />
        )}

        {/* Caso D: Conversa aberta mas contato NÃO encontrado */}
        {conversa?.aberta && !dadosContato && !carregandoConversa && conversa.erro !== 'nao_identificado' && (
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
          numeroConversa={conversa.numero}
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
