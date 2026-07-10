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
        <h1 className="mb-6 text-center text-2xl font-extrabold tracking-tight text-foreground">
          Conecta
        </h1>

        <form action={loginAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tenantSlug">Empresa</Label>
            <select
              id="tenantSlug"
              name="tenantSlug"
              required
              defaultValue=""
              className="h-12 w-full min-w-0 rounded-lg border border-input bg-transparent px-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
    </div>
  );
}
