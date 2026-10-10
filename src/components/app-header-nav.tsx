import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Calendar, Users, Building, LogOut } from 'lucide-react';
import { GalBrand } from '@/components/gal-brand';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function AppHeaderNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const currentPath = location.pathname;

  async function handleSignOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
      toast.success('Desconectado com sucesso.');
      await navigate({ to: '/auth', replace: true });
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao sair.');
    }
  }

  const navItems = [
    {
      title: 'Hoje',
      to: '/hoje',
      icon: Calendar,
      isActive: currentPath === '/hoje' || currentPath === '/inicio',
    },
    {
      title: 'Prospecção',
      to: '/prospeccao',
      icon: Users,
      isActive: currentPath.startsWith('/prospeccao'),
    },
    {
      title: 'Obras Prado',
      to: '/obras-prado',
      icon: Building,
      isActive: currentPath.startsWith('/obras-prado'),
    },
  ];

  return (
    <>
      {/* Top Header - Desktop & Mobile */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/95 px-4 backdrop-blur sm:px-8">
        <div className="flex items-center gap-8">
          <Link to="/prospeccao" className="transition hover:opacity-85">
            <GalBrand />
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Menu principal">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-colors ${
                    item.isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-muted-foreground hover:text-foreground gap-1.5"
            title="Sair do sistema"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar - Fixed */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-card/95 pb-safe backdrop-blur md:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.05)]"
        aria-label="Menu móvel"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-1 flex-col items-center justify-center py-1 transition-colors ${
                item.isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div
                className={`flex h-8 w-12 items-center justify-center rounded-full transition-all ${
                  item.isActive ? 'bg-primary/15' : ''
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
