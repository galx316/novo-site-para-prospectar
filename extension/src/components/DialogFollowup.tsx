import React, { useState } from 'react';
import { supabase } from '../supabase';
import { adicionarDiasSP, formatarData, obterHojeSP } from '../date-utils';
import type { Followup } from '../types';
import { showToast } from './Toast';
import { comTimeout } from '../async-utils';

interface DialogFollowupProps {
  contatoId: string;
  clienteId: string;
  contatoNome: string;
  followupPendente: Followup | null;
  atalhosDias?: number[];
  onClose: () => void;
  onSuccess: () => void;
}

export function DialogFollowup({
  contatoId,
  clienteId,
  contatoNome,
  followupPendente,
  atalhosDias = [3, 7, 15, 30],
  onClose,
  onSuccess,
}: DialogFollowupProps) {
  const isRemarcar = !!followupPendente;

  const primeiroAtalho = atalhosDias[0] || 7;
  const [novaData, setNovaData] = useState<string>(adicionarDiasSP(primeiroAtalho));
  const [motivo, setMotivo] = useState(
    isRemarcar ? followupPendente.motivo || '' : 'Follow-up agendado pelo WhatsApp'
  );
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!novaData) {
      showToast('Selecione uma data para o follow-up.', 'erro');
      return;
    }

    setCarregando(true);
    try {
      if (isRemarcar) {
        // Remarcar follow-up existente
        const { error: rpcErr } = await comTimeout(
          supabase.rpc('remarcar_followup', {
            p_id: followupPendente.id,
            p_data: novaData,
          }),
          10000,
          'Não foi possível conectar ao CRM. Verifique a internet.'
        );

        if (rpcErr) throw new Error(rpcErr.message);

        // Se motivo foi alterado
        const motivoTrim = motivo.trim();
        if (motivoTrim && motivoTrim !== followupPendente.motivo) {
          await supabase.from('followups').update({ motivo: motivoTrim }).eq('id', followupPendente.id);
        }

        showToast('Follow-up remarcado com sucesso!');
      } else {
        // Criar novo follow-up com registrar_atividade
        const { error: rpcErr } = await comTimeout(
          supabase.rpc('registrar_atividade', {
            p_tipo: 'nota',
            p_texto: 'Follow-up agendado pelo WhatsApp',
            p_contato_id: contatoId,
            p_cliente_id: clienteId,
            p_data_proxima: novaData,
            p_motivo: motivo.trim() || 'Follow-up agendado pelo WhatsApp',
          }),
          10000,
          'Não foi possível conectar ao CRM. Verifique a internet.'
        );

        if (rpcErr) throw new Error(rpcErr.message);

        showToast('Follow-up agendado com sucesso!');
      }

      onSuccess();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar follow-up.', 'erro');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="modal-header">
          <h3>{isRemarcar ? 'Remarcar Follow-up' : 'Agendar Follow-up'}</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={carregando}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <p className="modal-subtitle">
            {isRemarcar ? (
              <>
                Remarcando follow-up de <strong>{contatoNome}</strong>
                {followupPendente.data && (
                  <span className="field-hint"> (atual: {formatarData(followupPendente.data)})</span>
                )}
              </>
            ) : (
              <>
                Agendar novo follow-up para <strong>{contatoNome}</strong>.
              </>
            )}
          </p>

          <div className="form-group">
            <label>Nova data</label>
            <div className="atalhos-container">
              {atalhosDias.map((dias) => {
                const dataCalc = adicionarDiasSP(dias);
                const selecionado = novaData === dataCalc;
                return (
                  <button
                    key={dias}
                    type="button"
                    className={`btn-atalho ${selecionado ? 'active' : ''}`}
                    onClick={() => setNovaData(dataCalc)}
                  >
                    +{dias}d
                  </button>
                );
              })}
            </div>
            <input
              type="date"
              value={novaData}
              min={obterHojeSP()}
              onChange={(e) => setNovaData(e.target.value)}
              required
            />
            <span className="field-hint">Agendando para: {formatarData(novaData)}</span>
          </div>

          <div className="form-group">
            <label htmlFor="fu-motivo">Motivo do Follow-up</label>
            <input
              id="fu-motivo"
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Verificar retorno sobre esquadrias"
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={carregando}>
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={carregando}>
              {carregando ? 'Salvando...' : isRemarcar ? 'Remarcar' : 'Agendar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
