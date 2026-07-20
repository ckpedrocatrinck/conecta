import { Building2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// Tela "empresa nao encontrada" (ADR-010 §2 / INC-014): slug de tenant
// inexistente ou inativo. Requisito de isolamento: NUNCA lista tenants nem
// confirma quais existem (nao vazar clientes). Sem link para "/" — a raiz e' o
// site institucional, fora do escopo do produto. Renderizada pelo
// not-found.tsx do boundary [slug] (Bloco 4).
export function TenantNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <EmptyState
          icon={Building2}
          title="Empresa não encontrada"
          description="Confira o endereço de acesso com a sua empresa. Cada empresa tem um endereço próprio."
        />
      </div>
    </div>
  );
}
