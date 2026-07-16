import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// Q1 (auditoria de usabilidade 2026-07): sem isto, notFound() (usado em
// vagas/[id] e comunicados/[id]) cai no "This page could not be found" do
// Next em ingles, sem link de volta.
export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="flex w-full max-w-sm flex-col gap-4 text-center">
        <EmptyState
          icon={SearchX}
          title="Página não encontrada"
          description="O link pode estar errado ou o conteúdo não existe mais."
        />
        <Link href="/" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
