import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => { throw redirect({ to: '/inicio' }); },
  head: () => ({ meta: [
    { title: 'GAL Gestão | Acesso' },
    { name: 'description', content: 'Acesso ao GAL Gestão e seus alertas.' },
    { property: 'og:title', content: 'GAL Gestão | Acesso' },
    { property: 'og:description', content: 'Acesso ao GAL Gestão e seus alertas.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary' },
  ] }),
});