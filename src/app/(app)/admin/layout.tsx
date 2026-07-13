import { requireAdmin } from "../../../lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <div className="mx-auto w-full max-w-3xl px-4 py-8">{children}</div>;
}
