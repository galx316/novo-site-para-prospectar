import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { showToast } from './Toast';

interface DialogVincularProps {
  tituloConversa: string;
  numeroConversa?: string | null;
  onClose: () => void;
  onSuccess: (contatoId: string) => void;
}

interface ItemResultado {
  contatoId: string;
  contatoNome: string;
  contatoCargo: string | null;
  contatoWhatsapp: string | null;
  clienteId: string;
  clienteNome: string;
}

export function DialogVincular({
  tituloConversa,
  numeroConversa,
  onClose,
  onSuccess,
}: DialogVincularProps) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<ItemResultado[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [contatoPendente, setContatoPendente] = useState<ItemResultado | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Efetuar busca por nome de contato ou construtora
  useEffect(() => {
    const termo = busca.trim();
    if (termo.length < 2) {
      setResultados([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCarregando(true);
      try {
        // 1. Buscar contatos por ilike
        const { data: contatos, error: errC } = await supabase
          .from('contatos')
          .select('id, nome, cargo, whatsapp, cliente_id, clientes(id, nome)')
          .ilike('nome', `%${termo}%`)
          .limit(20);

        // 2. Buscar clientes por ilike
        const { data: clientes, error: errCli } = await supabase
          .from('clientes')
          .select('id, nome, contatos(id, nome, cargo, whatsapp, cliente_id)')
          .ilike('nome', `%${termo}%`)
          .limit(20);

        if (errC) console.error(errC);
        if (errCli) console.error(errCli);

        const lista: ItemResultado[] = [];
        const idsVistos = new Set<string>();

        (contatos || []).forEach((c: any) => {
          if (!idsVistos.has(c.id)) {
            idsVistos.add(c.id);
            lista.push({
              contatoId: c.id,
              contatoNome: c.nome,
              contatoCargo: c.cargo,
              contatoWhatsapp: c.whatsapp,
              clienteId: c.clientes?.id || c.cliente_id,
              clienteNome: c.clientes?.nome || 'Construtora',
            });
          }
        });

        (clientes || []).forEach((cli: any) => {
          (cli.contatos || []).forEach((c: any) => {
            if (!idsVistos.has(c.id)) {
              idsVistos.add(c.id);
              lista.push({
                contatoId: c.id,
                contatoNome: c.nome,
                contatoCargo: c.cargo,
                contatoWhatsapp: c.whatsapp,
                clienteId: cli.id,
                clienteNome: cli.nome,
              });
            }
          });
        });

        setResultados(lista);
      } catch (e) {
        console.error('Erro na busca de contatos:', e);
      } finally {
        setCarregando(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [busca]);

  async function handleSelecionar(item: ItemResultado) {
    // Se houver número na conversa e o contato não tiver whatsapp
    if (numeroConversa && !item.contatoWhatsapp) {
      setContatoPendente(item);
      return;
    }

    await concluirVinculo(item.contatoId, false);
  }

  async function concluirVinculo(contatoId: string, salvarNumero: boolean) {
    setSalvando(true);
    try {
      if (salvarNumero && numeroConversa) {
        const { error: errUpd } = await supabase
          .from('contatos')
          .update({ whatsapp: numeroConversa })
          .eq('id', contatoId);

        if (errUpd) {
          showToast(`Erro ao salvar WhatsApp: ${errUpd.message}`, 'erro');
        }
      }

      // Salvar vínculo em chrome.storage.local (título -> contato_id)
      const storageKey = `vinculo_${tituloConversa}`;
      await chrome.storage.local.set({ [storageKey]: contatoId });

      showToast('Contato vinculado com sucesso!');
      onSuccess(contatoId);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao vincular contato.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Vincular Conversa a Contato</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={salvando}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-subtitle">
            Vincular conversa "<strong>{tituloConversa}</strong>" a um contato cadastrado no GAL Gestão.
          </p>

          {contatoPendente ? (
            <div className="pergunta-salvar-numero">
              <div className="alert-box alert-warning">
                <strong>Salvar este número no contato?</strong>
                <p>
                  O contato <strong>{contatoPendente.contatoNome}</strong> ({contatoPendente.clienteNome}) não possui WhatsApp cadastrado.
                  Deseja salvar o número <strong>{numeroConversa}</strong>?
                </p>
              </div>

              <div className="modal-actions-stacked">
                <button
                  className="btn-primary btn-block"
                  disabled={salvando}
                  onClick={() => concluirVinculo(contatoPendente.contatoId, true)}
                >
                  {salvando ? 'Salvando...' : 'Sim, salvar número e vincular'}
                </button>
                <button
                  className="btn-secondary btn-block"
                  disabled={salvando}
                  onClick={() => concluirVinculo(contatoPendente.contatoId, false)}
                >
                  Não, apenas vincular
                </button>
                <button
                  className="btn-ghost btn-block"
                  disabled={salvando}
                  onClick={() => setContatoPendente(null)}
                >
                  Voltar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="busca-contato">Buscar contato ou construtora</label>
                <input
                  id="busca-contato"
                  type="text"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite pelo menos 2 letras..."
                  autoFocus
                />
              </div>

              <div className="lista-resultados">
                {carregando && <div className="loading-state">Buscando...</div>}

                {!carregando && busca.trim().length >= 2 && resultados.length === 0 && (
                  <div className="empty-state">Nenhum contato encontrado.</div>
                )}

                {!carregando &&
                  resultados.map((item) => (
                    <div
                      key={item.contatoId}
                      className="item-resultado"
                      onClick={() => handleSelecionar(item)}
                    >
                      <div className="item-contato-info">
                        <strong>{item.contatoNome}</strong>
                        {item.contatoCargo && <span className="item-cargo"> • {item.contatoCargo}</span>}
                        <div className="item-cliente">{item.clienteNome}</div>
                      </div>
                      <div className="item-wa">
                        {item.contatoWhatsapp ? (
                          <span className="badge-wa-existente">WA cadastrado</span>
                        ) : (
                          <span className="badge-wa-ausente">Sem WA</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
