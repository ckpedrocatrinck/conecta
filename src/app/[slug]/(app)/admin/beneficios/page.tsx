import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HomeBanner } from "@/components/home/home-banner";
import { requireAdmin } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findBenefitsForAdminList } from "@/lib/repositories/benefit.repository";
import { BENEFIT_CATEGORY_LABELS, BENEFIT_CATEGORY_ORDER } from "@/lib/benefits/category-labels";

const SUCCESS_MESSAGES: Record<string, string> = {
  removido: "Benefício removido.",
};

export default async function BenefitsAdminPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const session = await requireAdmin();
  const { ok } = await searchParams;

  const benefits = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findBenefitsForAdminList(tx, session.tenantId),
  );

  // Agrupa na ordem canonica de categorias; so' renderiza categoria com itens.
  const byCategory = BENEFIT_CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: benefits.filter((b) => b.category === cat),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-display text-foreground">Clube de Benefícios</h1>
          <p className="text-meta text-muted-foreground">Parcerias e vantagens que a empresa oferece aos colaboradores.</p>
        </div>
        <Link
          href={`/${session.tenantSlug}/admin/beneficios/novo`}
          className={buttonVariants({ variant: "default", size: "touch" })}
        >
          <Plus aria-hidden="true" />
          Novo benefício
        </Link>
      </div>

      <HomeBanner imageSrc="/banners/home.png" imageAlt="" title="Clube de Benefícios" />

      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      {byCategory.length === 0 ? (
        <p className="text-meta text-muted-foreground">Nenhum benefício cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {byCategory.map((group) => (
            <section key={group.category} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="category">{BENEFIT_CATEGORY_LABELS[group.category]}</Badge>
                <span className="text-meta text-muted-foreground">
                  {group.items.length} benefício{group.items.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((benefit) => (
                  <Link
                    key={benefit.id}
                    href={`/${session.tenantSlug}/admin/beneficios/${benefit.id}`}
                    className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-card-title font-bold text-foreground">{benefit.partnerName}</span>
                      <span className="inline-flex items-center gap-1.5 text-meta text-muted-foreground">
                        <span
                          className={`size-2 rounded-full ${benefit.active ? "bg-primary" : "bg-border-strong"}`}
                          aria-hidden="true"
                        />
                        {benefit.active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    <span className="text-body text-foreground">{benefit.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
