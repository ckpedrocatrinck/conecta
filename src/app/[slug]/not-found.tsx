import { TenantNotFound } from "@/components/tenant/tenant-not-found";

// Fronteira de "empresa nao encontrada" do subtree /{slug} (INC-014). Disparada
// pelo notFound() do layout quando o slug nao resolve. Isolada da not-found
// global (src/app/not-found.tsx) para dar a mensagem certa sem vazar tenants.
export default function TenantNotFoundPage() {
  return <TenantNotFound />;
}
