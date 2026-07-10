import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Painel admin</h1>
      <nav className="flex flex-col gap-2">
        <Link href="/admin/filiais" className="text-sm text-primary underline-offset-4 hover:underline">
          Filiais
        </Link>
        <Link href="/admin/colaboradores" className="text-sm text-primary underline-offset-4 hover:underline">
          Colaboradores
        </Link>
        <Link href="/admin/comunicados" className="text-sm text-primary underline-offset-4 hover:underline">
          Comunicados
        </Link>
      </nav>
    </div>
  );
}
