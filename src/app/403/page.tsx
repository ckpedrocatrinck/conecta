import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="size-7" aria-hidden="true" strokeWidth={1.8} />
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-foreground">Acesso negado</h1>
        <p className="mx-auto max-w-xs text-body text-muted-foreground">
          Você não tem permissão para acessar esta página.
        </p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "default", size: "touch" })}>
        Voltar ao início
      </Link>
    </div>
  );
}
