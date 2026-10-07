<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use protected TanStack server functions with the GAL bearer middleware for alert reads; verify authorization before querying to avoid misleading zero counts.
- Keep only the public login and authenticated home in this stage; the index redirects to the home under the client-only protected layout. Never fetch protected data in a public SSR loader.
- Schema, RLS, RPCs, triggers and seeds are managed through Supabase migrations; create storage buckets through the supported storage tool because bucket inserts are rejected by migrations.
- All business dates use the database hoje_sp helper and explicit America/Sao_Paulo formatting to avoid UTC day-boundary errors.
