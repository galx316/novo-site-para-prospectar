import React, { useState } from 'react';
import { supabase } from '../supabase';
import { comTimeout } from '../async-utils';

interface LoginViewProps {
  onSuccess: () => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    const emailTrim = email.trim();
    if (!emailTrim || !password) {
      setErro('Preencha seu e-mail e senha.');
      return;
    }

    setCarregando(true);
    try {
      const { error } = await comTimeout(
        supabase.auth.signInWithPassword({
          email: emailTrim,
          password,
        }),
        10000,
        'Não foi possível conectar ao CRM. Verifique a internet.'
      );

      if (error) {
        setErro(error.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos.' : error.message);
        return;
      }

      // Checar se o usuário é autorizado através da RPC is_authorized
      const { data: autorizado, error: rpcErr } = await comTimeout(
        supabase.rpc('is_authorized'),
        10000,
        'Não foi possível conectar ao CRM. Verifique a internet.'
      );
      if (rpcErr) {
        await supabase.auth.signOut();
        setErro(`Erro ao validar autorização: ${rpcErr.message}`);
        return;
      }

      if (!autorizado) {
        await supabase.auth.signOut();
        setErro('E-mail não autorizado.');
        return;
      }

      onSuccess();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível conectar ao CRM. Verifique a internet.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">G</div>
          <h2>GAL Gestão</h2>
          <p>Extensão Comercial para WhatsApp Web</p>
        </div>

        {erro && <div className="alert-box alert-error">{erro}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu.email@empresa.com"
              required
              disabled={carregando}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-pass">Senha</label>
            <input
              id="login-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={carregando}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn-primary btn-block" disabled={carregando}>
            {carregando ? 'Entrando...' : erro ? 'Tentar de novo' : 'Entrar'}
          </button>
        </form>

        <div className="login-footer">
          <p>Use as mesmas credenciais de acesso ao CRM GAL Gestão.</p>
        </div>
      </div>
    </div>
  );
}
