import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "./actions";

// Login tenant-scoped: a empresa e' definida pela URL (/{slug}/login), entao o
// seletor de empresa SAI (ADR-010 §3). O slug de params e' fixado no action via
// .bind — o tenant vem da URL, nao de um campo do form.
export default async function TenantLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ erro?: string }>;
}) {
  const [{ slug }, { erro }] = await Promise.all([params, searchParams]);
  const loginWithSlug = loginAction.bind(null, slug);

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-1.5 rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">
            C
          </div>
          <h1 className="text-display text-foreground">Conecta</h1>
          <p className="mb-4 text-meta text-muted-foreground">Comunicação interna da sua empresa</p>

          <form action={loginWithSlug} className="flex w-full flex-col gap-4">
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
                {erro === "rate"
                  ? "Muitas tentativas. Aguarde alguns minutos e tente novamente."
                  : "CPF ou senha inválidos."}
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
