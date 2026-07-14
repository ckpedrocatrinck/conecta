import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CLIENT_COMPONENTS_USING_PLATFORM = [
  "../../components/pwa/push-opt-in.tsx",
  "../../components/pwa/install-prompt.tsx",
];

/**
 * Regressao de bug real (QA em iPhone, INC-012): `push-opt-in.tsx` chamava
 * `isIos()`/`isStandalone()` direto no corpo do componente. O Node do
 * runtime do Next.js expoe um `navigator` global proprio desde a v21
 * (`navigator.userAgent` tipo "Node.js/24") — o SSR sempre calculava
 * "nao e' iOS" e embutia o branch errado no HTML inicial; no iPhone real
 * esse mismatch de hidratacao nao se corrigia (o botao "Ativar
 * notificacoes" ficava visivel no Safari sem o PWA instalado). Sem jsdom
 * neste projeto (vitest roda em `environment: "node"`) nao ha' como
 * simular SSR x hidratacao de verdade — este teste trava a regra que
 * evita a classe do bug: nenhum componente pode chamar as funcoes cruas,
 * so' os hooks hydration-safe (`useIosNonStandalone`/`useIsStandalone`).
 */
describe("uso hydration-safe de deteccao de plataforma", () => {
  it.each(CLIENT_COMPONENTS_USING_PLATFORM)("%s nao chama isIos()/isStandalone() direto", (relativePath) => {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf-8");
    expect(source).not.toMatch(/\bisIos\(/);
    expect(source).not.toMatch(/\bisStandalone\(/);
  });
});
