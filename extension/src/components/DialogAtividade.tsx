import React, { useState } from 'react';
import { supabase } from '../supabase';
import { formatarData, obterHojeSP } from '../date-utils';
import type { TipoRegistro } from '../types';
import { showToast } from './Toast';

interface DialogAtividadeProps {
  contatoId: string;
  clienteId: string;
  contatoNome: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function DialogAtividade({
  contatoId,
  clienteId,
  contatoNome,
  onClose,
  onSuccess,
}: DialogAtividadeProps) {
  const [tipo, setTipo] = useState<TipoRegistro>('ligacao');
  const [texto, setTexto] = useState('');
  const [dataProxima, setDataProxima] = useState('');
  const [motivo, setMotivo] = useState('');
  const [carregando, setCarregando] = useState(false);

  const tiposPermitidos: Array<{ key: TipoRegistro; label: string; icon: string }> = [
    { key: 'ligacao', label: 'Ligação', icon: '📞' },
    { key: 'visita', label: 'Visita', icon: '🚗' },
    { key: 'nota', label: 'Nota', icon: '📝' },
    { key: 'outro', label: 'Outro', icon: '📌' },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!texto.trim()) {
      showToast('Descreva a atividade.', 'erro');
      return;
    }

    setCarregando(true);
    try {
      const { error: rpcErr } = await supabase.rpc('registrar_atividade', {
        p_tipo: tipo,
        p_texto: texto.trim(),
        p_contato_id: contatoId,
        p_cliente_id: clienteId,
        ...(dataProxima ? { p_data_proxima: dataProxima } : {}),
        ...(motivo.trim() ? { p_motivo: motivo.trim() } : {}),
      });

      if (rpcErr) {
        throw new Error(rpcErr.message);
      }

      showToast('Atividade registrada com sucesso!');
      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao registrar atividade.', 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>Registrar Atividade</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={carregando}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-subtitle">
            Nova atividade para <strong>{contatoNome}</strong>.
          </p>

          <div className="form-group">
            <label>Tipo de atividade</label>
            <div className="tipo-atividade-grid">
              {tiposPermitidos.map((t) => {
                const ativo = tipo === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn-tipo-atividade ${ativo ? 'active' : ''}`}
                    onClick={() => setTipo(t.key)}
                  >
                    <span className="tipo-icon">{t.icon}</span>
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="ativ-texto">Descrição da atividade</label>
            <textarea
              id="ativ-texto"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Descreva o que foi conversado ou realizado..."
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ativ-data">Agendar próximo passo (opcional)</label>
            <input
              id="ativ-data"
              type="date"
              min={obterHojeSP()}
              value={dataProxima}
              onChange={(e) => setDataProxima(e.target.value)}
            />
            {dataProxima && (
              <span className="field-hint">Agendando para: {formatarData(dataProxima)}</span>
            )}
          </div>

          {dataProxima && (
            <div className="form-group">
              <label htmlFor="ativ-motivo">Motivo do próximo passo</label>
              <input
                id="ativ-motivo"
                type="text"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex: Enviar orçamento revisado"
              />
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : 'Salvar Atividade'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
