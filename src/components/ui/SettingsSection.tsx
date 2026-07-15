/** Primitivas de lista das telas Perfil e Configurações.
 *
 * Extraídas do SettingsPage sem alteração — as duas telas precisam do mesmo
 * visual, e duplicar o markup faria uma divergir da outra na primeira mudança.
 */
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium text-text-muted uppercase tracking-wider">{title}</h2>
      <div className="rounded-lg bg-bg-surface border border-bg-border divide-y divide-bg-border">
        {children}
      </div>
    </section>
  )
}

export function SettingsRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4">{children}</div>
}
