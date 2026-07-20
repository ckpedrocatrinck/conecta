import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findActiveTenants } from "../../lib/repositories/tenant.repository";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const [tenants, { erro }] = await Promise.all([findActiveTenants(), searchParams]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">
            C
          </div>
          <h1 className="text-display text-foreground">Conecta</h1>
          <p className="mb-4 text-meta text-muted-foreground">Comunicação interna da sua empresa</p>

          <form action={loginAction} className="flex w-full flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantSlug">Empresa</Label>
            <select
              id="tenantSlug"
              name="tenantSlug"
              required
              defaultValue=""
              className="h-12 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-card px-3.5 text-base outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary-subtle dark:bg-input/30"
            >
              <option value="" disabled>
                Selecione sua empresa
              </option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.slug}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              name="cpf"
              size="lg"
              inputMode="numeric"
              autoComplete="username"
              required
              placeholder="Somente números"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" name="password" size="lg" type="password" autoComplete="current-password" required />
          </div>

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              CPF, senha ou empresa inválidos.
            </p>
          )}

            <Button type="submit" size="xl" className="mt-2 w-full">
              Entrar
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-meta text-subtle-foreground">
          Acesso restrito a colaboradores cadastrados. Dados tratados conforme a LGPD.
        </p>
      </div>
    </div>
  );
}
