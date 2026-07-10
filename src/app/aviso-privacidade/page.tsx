import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireSession } from "../../lib/auth/session";
import { PRIVACY_NOTICE_BODY, PRIVACY_NOTICE_TITLE } from "../../lib/privacy/notice";
import { acceptPrivacyNoticeAction } from "./actions";

export default async function AvisoPrivacidadePage() {
  const session = await requireSession();
  // Nao pular a troca de senha obrigatoria navegando direto pra ca.
  if (session.mustChangePassword) redirect("/trocar-senha");
  if (session.privacyAccepted) redirect("/");

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="mb-4 text-center text-xl font-extrabold tracking-tight text-foreground">
          {PRIVACY_NOTICE_TITLE}
        </h1>

        <div className="mb-6 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm text-foreground">
          {PRIVACY_NOTICE_BODY}
        </div>

        <form action={acceptPrivacyNoticeAction}>
          <Button type="submit" variant="action" size="xl" className="w-full">
            Li e estou ciente
          </Button>
        </form>
      </div>
    </div>
  );
}
