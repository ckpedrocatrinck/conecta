/** INC-027 Bloco 3.7 tentou pular a troca de senha/aviso de privacidade para
 * TODA demo — decisão revertida no Bloco 3.8: o fluxo de primeiro acesso é
 * funcionalidade real do produto (o colaborador define a própria senha antes
 * de qualquer confirmação de ciência) e escondê-lo da demo some com o que
 * diferencia o produto. O atrito de verdade era só de DESENVOLVIMENTO (trocar
 * senha a cada reseed durante teste manual) — `SEED_SKIP_PASSWORD_CHANGE`
 * resolve isso sem mudar o comportamento padrão: exige `NODE_ENV=development`
 * (nunca em produção, mesmo que alguém sete a variável por engano) e é
 * opt-in (precisa valer exatamente "true").
 *
 * Módulo separado de `seed.ts` de propósito: `seed.ts` roda `main()` no
 * top-level assim que importado (é um script executável) — um teste que
 * importasse essa função direto de lá dispararia o seed inteiro contra o
 * banco como efeito colateral do import. */
export function shouldSkipFirstAccessFlow(env: { NODE_ENV?: string; SEED_SKIP_PASSWORD_CHANGE?: string }): boolean {
  return env.NODE_ENV === "development" && env.SEED_SKIP_PASSWORD_CHANGE === "true";
}
