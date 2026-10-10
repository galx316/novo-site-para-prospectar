import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({ to: '/prospeccao' });
  },
  head: () => ({
    meta: [
      { title: 'GAL Gestão | Acesso' },
      { name: 'description', content: 'Acesso ao GAL Gestão comercial e de obras.' },
      { property: 'og:title', content: 'GAL Gestão | Acesso' },
      { property: 'og:description', content: 'Acesso ao GAL Gestão comercial e de obras.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary' },
    ],
  }),
});