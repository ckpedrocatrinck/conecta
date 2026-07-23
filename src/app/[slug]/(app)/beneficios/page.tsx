import { ChevronDown, Gift, MapPin, Phone } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { HomeBanner } from "@/components/home/home-banner";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findActiveBenefitsForEmployee } from "@/lib/repositories/benefit.repository";
import { BENEFIT_CATEGORY_LABELS, BENEFIT_CATEGORY_ORDER } from "@/lib/benefits/category-labels";

export default async function BeneficiosPage() {
  const session = await requireOnboardedSession();

  const benefits = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findActiveBenefitsForEmployee(tx, session.tenantId),
  );

  // Agrupa na ordem canonica; so' categorias com pelo menos um beneficio ativo.
  const groups = BENEFIT_CATEGORY_ORDER.map((category) => ({
    category,
    items: benefits.filter((b) => b.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-foreground">Clube de Benefícios</h1>
        <p className="text-meta text-muted-foreground">
          Vantagens e parcerias que a empresa oferece a você. Toque numa categoria para ver os detalhes.
        </p>
      </div>

      <HomeBanner title="Clube de Benefícios" subtitle="Descontos e vantagens para colaboradores." />

      {groups.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Nenhum benefício disponível ainda"
          description="Assim que a empresa cadastrar vantagens e parcerias, elas aparecem aqui."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <details key={group.category} open className="group rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2.5">
                  <Badge variant="category">{BENEFIT_CATEGORY_LABELS[group.category]}</Badge>
                  <span className="text-meta text-muted-foreground">
                    {group.items.length} benefício{group.items.length !== 1 ? "s" : ""}
                  </span>
                </span>
                <ChevronDown
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>

              <ul className="flex flex-col gap-3 border-t border-border p-4">
                {group.items.map((benefit) => (
                  <li key={benefit.id} className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border bg-background p-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-card-title font-bold text-foreground">{benefit.partnerName}</span>
                      <span className="text-body font-semibold text-primary-deep">{benefit.title}</span>
                    </div>
                    <p className="whitespace-pre-line text-body text-foreground-soft">{benefit.description}</p>
                    {(benefit.location || benefit.contact) && (
                      <div className="mt-1 flex flex-col gap-1 text-meta text-muted-foreground">
                        {benefit.location && (
                          <span className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span>{benefit.location}</span>
                          </span>
                        )}
                        {benefit.contact && (
                          <span className="flex items-start gap-1.5">
                            <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                            <span>{benefit.contact}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
