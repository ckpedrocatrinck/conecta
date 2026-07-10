import { Button } from "@/components/ui/button";
import { signOut } from "../lib/auth/config";
import { requireOnboardedSession } from "../lib/auth/session";
import { withTenant } from "../lib/db/with-tenant";
import { findUserById } from "../lib/repositories/user.repository";

export default async function Home() {
  const session = await requireOnboardedSession();
  const user = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findUserById(tx, session.tenantId, session.userId),
  );

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Conecta</h1>
      <p className="max-w-xs text-base text-zinc-600 dark:text-zinc-400">
        Bem-vindo(a), {user?.fullName ?? "colaborador(a)"}. Em construção — nenhuma funcionalidade além do login está
        disponível ainda.
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="secondary">
          Sair
        </Button>
      </form>
    </div>
  );
}
