/** Capa de imagem do card (INC-016) — mostra a imagem INTEIRA (object-contain,
 * nunca corta) e preenche o espaco que sobraria com a mesma imagem borrada e
 * ampliada ao fundo (blurred fill), entao nao ha' faixa vazia mesmo quando a
 * proporcao da imagem nao bate com a da capa. Padrao de galerias/streaming.
 * `src` e' uma URL assinada de curta duracao resolvida no servidor. */
export function PostCover({ src, className = "h-40" }: { src: string; className?: string }) {
  return (
    <div className={`relative w-full overflow-hidden rounded-lg bg-muted ${className}`}>
      {/* Fundo: mesma imagem, borrada e ampliada, cobrindo toda a area. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 size-full scale-110 object-cover blur-xl"
      />
      {/* Vela suave para dar contraste/acabamento sobre o fundo borrado. */}
      <div className="absolute inset-0 bg-foreground/5" aria-hidden="true" />
      {/* Frente: imagem inteira, sem corte. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- URL assinada, curta duracao */}
      <img src={src} alt="" className="relative size-full object-contain" />
    </div>
  );
}
