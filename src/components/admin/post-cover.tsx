/** Capa de imagem do card na GRADE do admin (INC-016). Grade precisa de altura
 * uniforme, entao aqui a capa e' fixa em 4:3 com `object-cover` (corte central
 * leve, sem borrao) — e' tela de gestao, o corte leve so' serve pra o admin
 * reconhecer o post de relance. No FEED (lista vertical) a imagem usa aspecto
 * natural (Solucao B), nao esta capa. `src` e' URL assinada de curta duracao. */
export function PostCover({ src }: { src: string }) {
  return (
    // object-top: o corte do 4:3 come a base, nunca o topo (nao decapita).
    // eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao
    <img src={src} alt="" className="aspect-[4/3] w-full rounded-lg bg-muted object-cover object-top" />
  );
}
