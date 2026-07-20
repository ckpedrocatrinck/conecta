import { requireAdminOrManager } from "@/lib/auth/session";

export default async function PendenciasLayout({ children }: { children: React.ReactNode }) {
  await requireAdminOrManager();
  return <div className="mx-auto w-full max-w-3xl px-4 py-8">{children}</div>;
}
