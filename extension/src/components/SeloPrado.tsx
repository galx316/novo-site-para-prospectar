import React from 'react';
import type { SituacaoPrado } from '../types';

interface SeloPradoProps {
  situacao?: SituacaoPrado | null;
  representante?: string | null;
}

export function SeloPrado({ situacao, representante }: SeloPradoProps) {
  if (situacao === 'ja_cliente') {
    return (
      <span className="selo-prado selo-azul" title="Esta construtora já é cliente">
        <span className="selo-dot"></span>
        Já é cliente
      </span>
    );
  }

  if (situacao === 'atendida_outro_rep') {
    return (
      <span
        className="selo-prado selo-vermelho"
        title={`Atendida por ${representante || 'outro representante'}`}
      >
        <span className="selo-dot"></span>
        PRADO: atendida por {representante || 'outro rep.'}
      </span>
    );
  }

  if (situacao === 'nao_verificado' || !situacao) {
    return (
      <span className="selo-prado selo-amarelo" title="Situação PRADO não verificada">
        <span className="selo-dot"></span>
        PRADO: não verificado
      </span>
    );
  }

  if (situacao === 'livre') {
    return (
      <span className="selo-prado selo-cinza" title="Livre para prospecção">
        <span className="selo-dot"></span>
        PRADO: livre
      </span>
    );
  }

  return null;
}
