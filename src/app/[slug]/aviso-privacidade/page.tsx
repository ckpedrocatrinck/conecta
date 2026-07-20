import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/config";
import { requireSession } from "@/lib/auth/session";
import { PRIVACY_NOTICE_BODY, PRIVACY_NOTICE_TITLE, PRIVACY_NOTICE_VERSION } from "@/lib/privacy/notice";
import { acceptPrivacyNoticeAction } from "./actions";

// Q2 (auditoria de usabilidade 2026-07): o texto juridico definitivo e'
// pendencia do INC-013 (ver docs/03-LGPD) — nao inventar texto aqui. Enquanto
// PRIVACY_NOTICE_VERSION carregar "placeholder", troca-se so' a APRESENTACAO
// (titulo/corpo digno, sem "PENDENTE-JURÍDICO" cru) por uma tela interina;
// quando o texto definitivo for aprovado e a versao deixar de ser
// "placeholder", esta tela volta a mostrar o conteudo real automaticamente.
const IS_PLACEHOLDER = PRIVACY_NOTICE_VERSION.includes("placeholder");
const INTERIM_TITLE = "Aviso de Privacidade";
const INTERIM_BODY =
  "Estamos preparando o texto definitivo deste aviso. Assim que estiver pronto, " +
  "você vai revisá-lo aqui antes de continuar.\n\n" +
  "Enquanto isso, para dar continuidade ao seu cadastro, saiba que a Conecta trata " +
  "os dados necessários para o funcionamento da plataforma (login, direcionamento " +
  "de comunicados internos) e para cumprir obrigações trabalhistas da empresa " +
  "(registro de ciência de comunicados). Você pode revogar a exibição de aniversário " +
  "e foto para os demais colaboradores a qualquer momento, na tela \"Meus dados\".";

export default async function AvisoPrivacidadePage() {
  const session = await requireSession();
  // Nao pular a troca de senha obrigatoria navegando direto pra ca.
  if (session.mustChangePassword) redirect(`/${session.tenantSlug}/trocar-senha`);
  if (session.privacyAccepted) redirect(`/${session.tenantSlug}`);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-lg">
        <h1 className="mb-4 text-center text-xl font-extrabold tracking-tight text-foreground">
          {IS_PLACEHOLDER ? INTERIM_TITLE : PRIVACY_NOTICE_TITLE}
        </h1>

        <div className="mb-6 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-card)] border border-border bg-card p-4 text-sm text-foreground">
          {IS_PLACEHOLDER ? INTERIM_BODY : PRIVACY_NOTICE_BODY}
        </div>

        <form action={acceptPrivacyNoticeAction}>
          <Button type="submit" variant="action" size="xl" className="w-full">
            Li e estou ciente
          </Button>
        </form>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: `/${session.tenantSlug}/login` });
          }}
          className="mt-3"
        >
          <Button type="submit" variant="ghost" size="touch" className="w-full">
            Sair
          </Button>
        </form>
      </div>
    </div>
  );
}
