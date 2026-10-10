import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { AppHeaderNav } from '@/components/app-header-nav';
import { Toaster } from '@/components/ui/sonner';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: '/auth' });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeaderNav />
      <div className="flex-1 pb-20 md:pb-8">
        <Outlet />
      </div>
      <Toaster position="top-right" richColors closeButton />
    </div>
  );
}