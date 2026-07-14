"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { AvatarFallback } from "@/components/cards/avatar-fallback";
import { birthdayDayLabel } from "@/lib/birthdays/build-birthday-view";
import type { BirthdayListEntry } from "@/lib/birthdays/build-birthday-view";

/**
 * Busca por nome dentro da tela de aniversariantes — filtra SO' sobre
 * `entries`, que ja chegou do servidor com `birthday_visible=false` excluido
 * (findUpcomingBirthdays). O navegador nunca recebe quem esta oculto, entao
 * nenhum termo de busca consegue faze-lo aparecer (criterio de aceite LGPD:
 * "busca de marcação de aniversário" tambem respeita o opt-out).
 */
export function BirthdaySearch({
  entries,
  branchNameById,
  showBranch,
}: {
  entries: BirthdayListEntry[];
  branchNameById: Map<string, string>;
  showBranch: boolean;
}) {
  const [query, setQuery] = useState("");

  const term = query.trim().toLowerCase();
  const filtered = term ? entries.filter((e) => e.fullName.toLowerCase().includes(term)) : entries;

  return (
    <div className="flex flex-col gap-3">
      <Input
        placeholder="Buscar por nome…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar aniversariante por nome"
      />

      {filtered.length === 0 ? (
        <p className="p-2 text-sm text-muted-foreground">Ninguém encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((entry) => (
            <div
              key={entry.userId}
              className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <AvatarFallback fullName={entry.fullName} photoUrl={entry.photoUrl} size={40} />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{entry.fullName}</span>
                  {showBranch && (
                    <span className="text-xs text-subtle-foreground">
                      {branchNameById.get(entry.branchId) ?? "—"}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={
                  entry.offsetDays === 0
                    ? "shrink-0 rounded-full bg-primary-subtle px-2.5 py-1 text-xs font-semibold text-primary"
                    : "shrink-0 text-xs font-semibold text-subtle-foreground"
                }
              >
                {birthdayDayLabel(entry.offsetDays, entry.month, entry.day)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
