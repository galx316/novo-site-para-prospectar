import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, LockKeyhole } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { GalBrand } from '@/components/gal-brand';

export const Route = createFileRoute('/auth')({
  head: () => ({ meta: [
    { title: 'Entrar | GAL Gestão' },
    { name: 'description', content: 'Acesso autorizado ao GAL Gestão.' },
    { property: 'og:title', content: 'Entrar | GAL Gestão' },
    { property: 'og:description', content: 'Acesso autorizado ao GAL Gestão.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: authorized } = await supabase.rpc('is_authorized');
      if (active && authorized) navigate({ to: '/' });
    });
    return () => { active = false; };
  }, [navigate]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        setError(signInError.code === 'invalid_credentials' ? 'E-mail ou senha inválidos.' : signInError.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar.' : 'Não foi possível entrar. Tente novamente.');
        return;
      }
      const { data: authorized, error: checkError } = await supabase.rpc('is_authorized');
      if (checkError || !authorized) {
        await supabase.auth.signOut();
        setError(checkError ? 'Não foi possível verificar seu acesso. Tente novamente.' : 'Seu e-mail não está autorizado.'); return;
      }
      await navigate({ to: '/' });
    } catch { setError('Não foi possível conectar. Tente novamente.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-svh flex-col bg-background">
    <header className="flex items-center justify-between border-b border-border px-6 py-6 sm:px-12"><GalBrand /><span className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={14} /> Acesso restrito</span></header>
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <section className="w-full max-w-[380px]">
        <div className="mb-9"><div className="mb-6 h-1 w-10 bg-primary" /><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">Bem-vindo ao GAL Gestão</p><h1 className="text-3xl font-semibold">Entrar na sua conta</h1><p className="mt-3 text-sm text-muted-foreground">Informe suas credenciais para continuar.</p></div>
        <form onSubmit={submit} className="space-y-5">
          <div><label htmlFor="email" className="mb-2 block text-sm font-medium">E-mail</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="gal-input" disabled={busy} /></div>
          <div><label htmlFor="password" className="mb-2 block text-sm font-medium">Senha</label><div className="relative"><input id="password" type={visible ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="gal-input pr-12" disabled={busy} /><Button type="button" variant="ghost" size="icon" title={visible ? 'Ocultar senha' : 'Mostrar senha'} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-1 top-1.5 text-muted-foreground" onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button></div></div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-12 w-full justify-between px-5">{busy ? 'Entrando…' : 'Entrar'}{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}</Button>
        </form>
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole size={13} /> Exclusivo para usuários autorizados</p>
      </section>
    </div>
    <footer className="flex flex-wrap justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:px-12"><span>GAL Gestão</span><span>America/Sao_Paulo</span></footer>
  </main>;
}