import { describe, expect, it } from "vitest";
import { shouldSkipFirstAccessFlow } from "./seed-env";

// INC-027 Bloco 3.8: SEED_SKIP_PASSWORD_CHANGE existe só para agilizar
// reseed durante desenvolvimento local — comportamento padrão (variável
// ausente) precisa continuar exigindo o fluxo de primeiro acesso real
// (troca de senha + aviso de privacidade), em qualquer ambiente.
describe("shouldSkipFirstAccessFlow (INC-027 Bloco 3.8)", () => {
  it("por padrão (variável ausente), NÃO pula o primeiro acesso, mesmo em desenvolvimento", () => {
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "development" })).toBe(false);
  });

  it("só pula quando NODE_ENV=development E a variável vale exatamente 'true'", () => {
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "development", SEED_SKIP_PASSWORD_CHANGE: "true" })).toBe(true);
  });

  it("nunca pula fora de development, mesmo com a variável setada", () => {
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "production", SEED_SKIP_PASSWORD_CHANGE: "true" })).toBe(false);
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "test", SEED_SKIP_PASSWORD_CHANGE: "true" })).toBe(false);
    expect(shouldSkipFirstAccessFlow({ SEED_SKIP_PASSWORD_CHANGE: "true" })).toBe(false);
  });

  it("valores 'truthy' que não sejam a string exata 'true' não ativam a flag (evita 1/yes/on por engano)", () => {
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "development", SEED_SKIP_PASSWORD_CHANGE: "1" })).toBe(false);
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "development", SEED_SKIP_PASSWORD_CHANGE: "yes" })).toBe(false);
    expect(shouldSkipFirstAccessFlow({ NODE_ENV: "development", SEED_SKIP_PASSWORD_CHANGE: "" })).toBe(false);
  });
});
