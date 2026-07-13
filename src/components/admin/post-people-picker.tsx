"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type PickablePerson = {
  id: string;
  fullName: string;
  registrationCode: string;
  photoVisible: boolean;
  /** Já resolvida com o consentimento aplicado (null quando photoVisible é
   * false) — mesma regra de toPostPersonView, usada pelo preview de card
   * (INC-009) para não vazar foto de quem não consente nem no rascunho. */
  photoUrl: string | null;
};

/**
 * Busca no cadastro real (nao aceita nome livre — so' marca quem esta nesta
 * lista, vinda do banco). Aviso de consentimento de foto aparece no momento
 * da marcacao (LGPD): pessoa com `photoVisible=false` mostra o aviso ao
 * lado do nome, sempre visivel, sem exigir confirmacao extra para marcar.
 */
export function PostPeoplePicker({
  people,
  defaultSelectedIds = [],
  onSelectionChange,
}: {
  people: PickablePerson[];
  defaultSelectedIds?: string[];
  /** Usado pelo preview de card no formulário do admin (INC-009) — não afeta
   * o submit do form, que continua lendo os checkboxes via FormData. */
  onSelectionChange?: (selected: PickablePerson[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(defaultSelectedIds));

  function toggle(person: PickablePerson, checked: boolean) {
    // Monta o proximo Set fora do updater do setState: chamar
    // onSelectionChange (que dispara o setState do componente pai) de
    // DENTRO do updater conta como "atualizar um componente durante a
    // renderizacao de outro" para o React — precisa rodar so' depois, como
    // uma chamada normal no corpo do handler.
    const next = new Set(selectedIds);
    if (checked) next.add(person.id);
    else next.delete(person.id);
    setSelectedIds(next);
    onSelectionChange?.(people.filter((p) => next.has(p.id)));
  }

  const filtered = people.filter((p) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return p.fullName.toLowerCase().includes(term) || p.registrationCode.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="post-people-search">Pessoas marcadas</Label>
      <Input
        id="post-people-search"
        placeholder="Buscar por nome ou matrícula…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-2">
        {filtered.length === 0 && <p className="p-2 text-sm text-muted-foreground">Ninguém encontrado.</p>}
        {filtered.map((person) => (
          <label key={person.id} className="flex items-start gap-2.5 rounded-md p-1.5 text-sm text-foreground hover:bg-muted">
            <Checkbox
              name="personIds"
              value={person.id}
              checked={selectedIds.has(person.id)}
              onCheckedChange={(checked) => toggle(person, checked === true)}
            />
            <span className="flex flex-col">
              <span>
                {person.fullName} <span className="text-muted-foreground">({person.registrationCode})</span>
              </span>
              {!person.photoVisible && (
                <span className="text-xs text-warning">Sem consentimento de foto — aparece só com o nome no card.</span>
              )}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
