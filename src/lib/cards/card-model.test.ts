import { describe, expect, it } from "vitest";
import { buildPostCardData, isPostCardKind, toCardBranding, toCardPerson } from "./card-model";
import type { FeedPostCard } from "../feed/build-feed-view";

const BRANDING = { logoUrl: null, accentColor: null };

function makePost(overrides: Partial<FeedPostCard> = {}): FeedPostCard {
  return {
    id: "post-1",
    type: "recognition",
    title: "Reconhecimento",
    body: null,
    eventDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    branchName: null,
    people: [],
    media: [],
    reactionCount: 0,
    reactedByMe: false,
    ...overrides,
  };
}

describe("buildPostCardData", () => {
  it("retorna null para tipos sem template dedicado (general)", () => {
    expect(buildPostCardData(makePost({ type: "general" }), BRANDING)).toBeNull();
  });

  it("monta o card para os 3 tipos com template (recognition/tenure/promotion)", () => {
    for (const type of ["recognition", "tenure", "promotion"] as const) {
      const data = buildPostCardData(makePost({ type }), BRANDING);
      expect(data?.kind).toBe(type);
    }
  });

  it("card com nome de 40+ caracteres não lança erro e preserva o texto completo (sem truncar)", () => {
    const longName = "Maria Aparecida dos Santos Oliveira Nascimento";
    const post = makePost({
      people: [{ userId: "u1", fullName: longName, label: null, photoUrl: null }],
    });

    const data = buildPostCardData(post, BRANDING);
    expect(data?.people[0].fullName).toBe(longName);
    expect(data?.people[0].initial).toBe("M");
  });

  it("sem foto (photoUrl null) — pessoa vira fallback de inicial, nunca quebra", () => {
    const post = makePost({
      people: [{ userId: "u1", fullName: "Ana Silva", label: null, photoUrl: null }],
    });

    const data = buildPostCardData(post, BRANDING);
    expect(data?.people[0].photoUrl).toBeNull();
    expect(data?.people[0].initial).toBe("A");
    expect(data?.people[0].avatarColor.bg).toBeTruthy();
  });

  it("nunca inventa foto: se o dado de entrada já chega com photoUrl null (sem consentimento), o card nunca recebe foto", () => {
    // A checagem de consentimento em si é responsabilidade de toPostPersonView/
    // buildFeedCards (ver tests/integration/post-feed-consent.test.ts) — aqui
    // garantimos que o mapper do card não reintroduz a foto por outro caminho.
    const person = toCardPerson({ fullName: "Sem Consentimento", photoUrl: null });
    expect(person.photoUrl).toBeNull();
  });

  it("cor de destaque inválida ou ausente cai no fallback de marca", () => {
    expect(toCardBranding({ logoUrl: null, accentColor: null }).accentColor).toBe("#2f7a5f");
    expect(toCardBranding({ logoUrl: null, accentColor: "not-a-color" }).accentColor).toBe("#2f7a5f");
    expect(toCardBranding({ logoUrl: null, accentColor: "#ABCDEF" }).accentColor).toBe("#ABCDEF");
  });
});

describe("isPostCardKind", () => {
  it("reconhece os 3 tipos com template e rejeita general", () => {
    expect(isPostCardKind("recognition")).toBe(true);
    expect(isPostCardKind("tenure")).toBe(true);
    expect(isPostCardKind("promotion")).toBe(true);
    expect(isPostCardKind("general")).toBe(false);
  });
});
