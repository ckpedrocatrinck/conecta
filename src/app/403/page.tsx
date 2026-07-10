export default function ForbiddenPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 px-6 py-16 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Acesso negado</h1>
      <p className="max-w-xs text-base text-zinc-600 dark:text-zinc-400">
        Você não tem permissão para acessar esta página.
      </p>
    </div>
  );
}
