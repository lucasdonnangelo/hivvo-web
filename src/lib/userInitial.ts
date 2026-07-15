/** Inicial do avatar do usuário.
 *
 * `nome_completo` é NOT NULL desde a migration inicial, mas o RegisterRequest do
 * backend não tem min_length — uma chamada direta à API consegue gravar "" (a UI
 * exige 2+). Por isso a cadeia toda é opcional e o `?? '?'` vem ANTES do
 * toUpperCase: `""[0]` é undefined e `undefined.toUpperCase()` estouraria.
 */
export function initialDoUsuario(nome?: string, email?: string): string {
  return (nome?.trim()?.[0] ?? email?.trim()?.[0] ?? '?').toUpperCase()
}
