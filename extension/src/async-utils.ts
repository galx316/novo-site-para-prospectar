/**
 * Utilitário para executar promessas (e thenables do Supabase) com tempo limite estrito (10s por padrão)
 * e evitar estados de carregamento infinito.
 */
export function comTimeout<T>(
  promise: PromiseLike<T>,
  ms = 10000,
  mensagemErro = 'Não foi possível conectar ao CRM. Verifique a internet.'
): Promise<T> {
  const p = Promise.resolve(promise);
  return Promise.race([
    p,
    new Promise<never>((_, reject) => {
      const id = setTimeout(() => {
        reject(new Error(mensagemErro));
      }, ms);
      p.then(
        () => clearTimeout(id),
        () => clearTimeout(id)
      );
    }),
  ]);
}
