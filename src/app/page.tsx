import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PendingBanner } from "@/components/ui/pending-banner";
import { signOut } from "../lib/auth/config";
import { requireOnboardedSession } from "../lib/auth/session";
import { withTenant } from "../lib/db/with-tenant";
import { findUserById } from "../lib/repositories/user.repository";
import { countPendingAcksForUser } from "../lib/announcements/list-for-user";

export default async function Home() {
  const session = await requireOnboardedSession();
  const { user, pendingCount } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    user: await findUserById(tx, session.tenantId, session.userId),
    pendingCount: await countPendingAcksForUser(tx, session.tenantId, session.userId),
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-50 px-4 py-6 dark:bg-black">
      <h1 className="text-2xl font-extrabold tracking-tight text-black dark:text-zinc-50">Conecta</h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400">Bem-vindo(a), {user?.fullName ?? "colaborador(a)"}.</p>

      {pendingCount > 0 && (
        <PendingBanner
          message={`${pendingCount} comunicado${pendingCount > 1 ? "s" : ""} aguardando sua ciência`}
          action={
            <Link href="/comunicados" className="shrink-0 text-sm font-semibold text-action underline-offset-4 hover:underline">
              Ver
            </Link>
          }
        />
      )}

      <Link href="/comunicados" className="text-primary underline-offset-4 hover:underline">
        Ver comunicados
      </Link>

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
