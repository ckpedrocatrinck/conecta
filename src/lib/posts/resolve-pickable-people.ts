import { mediaStorage } from "../storage/media-storage";

type RawPickablePerson = {
  id: string;
  fullName: string;
  registrationCode: string;
  photoVisible: boolean;
  photoUrl: string | null;
};

/**
 * Aplica a mesma regra de consentimento de `toPostPersonView` (nunca expõe
 * foto de quem tem `photoVisible=false`) e assina a URL de quem consente —
 * usado para o picker de pessoas do admin alimentar o preview de card
 * (INC-009) com exatamente o que o card final vai mostrar.
 */
export async function resolvePickablePeoplePhotos<T extends RawPickablePerson>(
  people: T[],
): Promise<(T & { photoUrl: string | null })[]> {
  return Promise.all(
    people.map(async (p) => ({
      ...p,
      photoUrl: p.photoVisible && p.photoUrl ? await mediaStorage.getViewUrl(p.photoUrl) : null,
    })),
  );
}
