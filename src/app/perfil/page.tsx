import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOnboardedSession } from "../../lib/auth/session";
import { withTenant } from "../../lib/db/with-tenant";
import { findUserById } from "../../lib/repositories/user.repository";
import { mediaStorage } from "../../lib/storage/media-storage";
import { changePasswordFromProfileAction, updateConsentAction } from "./actions";
import { PhotoUploader } from "./photo-uploader";

const PASSWORD_ERROR_MESSAGES: Record<string, string> = {
  atual: "Senha atual incorreta.",
  curta: "A nova senha precisa ter pelo menos 8 caracteres.",
  confirmacao: "A confirmação não confere com a nova senha.",
};

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; senha?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { erro, senha } = await searchParams;

  const user = await withTenant({ tenantId: session.tenantId }, (tx) =>
    findUserById(tx, session.tenantId, session.userId),
  );
  if (!user) return null;

  const photoViewUrl = user.photoUrl ? await mediaStorage.getViewUrl(user.photoUrl) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8 px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">Meus dados</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Foto de perfil</h2>
        <PhotoUploader currentPhotoUrl={photoViewUrl} />
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Dados cadastrais</h2>
        <p><span className="font-medium">Nome:</span> {user.fullName}</p>
        <p><span className="font-medium">Matrícula:</span> {user.registrationCode}</p>
        <p><span className="font-medium">Papel:</span> {user.role}</p>
        {user.phone && <p><span className="font-medium">Telefone:</span> {user.phone}</p>}
        {user.email && <p><span className="font-medium">E-mail:</span> {user.email}</p>}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Consentimentos</h2>
        <form action={updateConsentAction} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="birthdayVisible" defaultChecked={user.birthdayVisible} />
            Exibir meu aniversário para os demais colaboradores
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="photoVisible" defaultChecked={user.photoVisible} />
            Exibir minha foto para os demais colaboradores
          </label>
          <Button type="submit" variant="secondary" className="self-start">
            Salvar consentimentos
          </Button>
        </form>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">Trocar senha</h2>
        <form action={changePasswordFromProfileAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </div>

          {erro && PASSWORD_ERROR_MESSAGES[erro] && (
            <p role="alert" className="text-sm text-destructive">
              {PASSWORD_ERROR_MESSAGES[erro]}
            </p>
          )}
          {senha === "ok" && <p className="text-sm text-emerald-600 dark:text-emerald-400">Senha alterada com sucesso.</p>}

          <Button type="submit" className="self-start">
            Trocar senha
          </Button>
        </form>
      </section>
    </div>
  );
}
