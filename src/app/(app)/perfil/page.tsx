import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import { findUserById } from "../../../lib/repositories/user.repository";
import { findMyJobApplications } from "../../../lib/repositories/job-opening.repository";
import { findPushSubscriptionsForUser } from "../../../lib/repositories/push-subscription.repository";
import { mediaStorage } from "../../../lib/storage/media-storage";
import { formatDateTimeSaoPaulo } from "../../../lib/dates/format-datetime";
import { changePasswordFromProfileAction, updateConsentAction } from "./actions";
import { PhotoUploader } from "./photo-uploader";
import { PushOptIn } from "@/components/pwa/push-opt-in";

const JOB_STATUS_LABEL: Record<string, string> = {
  open: "Aberta",
  closed: "Fechada",
};

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

  const { user, myApplications, pushSubscriptions } = await withTenant({ tenantId: session.tenantId }, async (tx) => ({
    user: await findUserById(tx, session.tenantId, session.userId),
    myApplications: await findMyJobApplications(tx, session.tenantId, session.userId),
    pushSubscriptions: await findPushSubscriptionsForUser(tx, session.tenantId, session.userId),
  }));
  if (!user) return null;

  const photoViewUrl = user.photoUrl ? await mediaStorage.getViewUrl(user.photoUrl) : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 bg-background px-4 py-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Meus dados</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Foto de perfil</h2>
        <PhotoUploader currentPhotoUrl={photoViewUrl} />
      </section>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Dados cadastrais</h2>
        <div className="flex flex-col gap-1 text-foreground">
          <p><span className="font-medium">Nome:</span> {user.fullName}</p>
          <p><span className="font-medium">Matrícula:</span> {user.registrationCode}</p>
          <p><span className="font-medium">Papel:</span> {user.role}</p>
          {user.phone && <p><span className="font-medium">Telefone:</span> {user.phone}</p>}
          {user.email && <p><span className="font-medium">E-mail:</span> {user.email}</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Minhas candidaturas</h2>
        {myApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você ainda não se candidatou a nenhuma vaga.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myApplications.map((application) => (
              <Link
                key={application.jobOpeningId}
                href={`/vagas/${application.jobOpeningId}`}
                className="flex items-center justify-between rounded-lg border border-border p-2.5 text-sm hover:bg-muted"
              >
                <span className="font-medium text-foreground">{application.jobOpening.title}</span>
                <span className="text-muted-foreground">
                  {formatDateTimeSaoPaulo(application.createdAt)} ·{" "}
                  {JOB_STATUS_LABEL[application.jobOpening.status] ?? application.jobOpening.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Notificações push</h2>
        <PushOptIn subscriptions={pushSubscriptions} />
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Consentimentos</h2>
        <form action={updateConsentAction} className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <Checkbox name="birthdayVisible" defaultChecked={user.birthdayVisible} />
            Exibir meu aniversário para os demais colaboradores
          </label>
          <label className="flex items-center gap-2.5 text-sm text-foreground">
            <Checkbox name="photoVisible" defaultChecked={user.photoVisible} />
            Exibir minha foto para os demais colaboradores
          </label>
          <Button type="submit" variant="secondary" size="lg" className="self-start">
            Salvar consentimentos
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-muted-foreground">Trocar senha</h2>
        <form action={changePasswordFromProfileAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input id="currentPassword" name="currentPassword" size="lg" type="password" autoComplete="current-password" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input id="newPassword" name="newPassword" size="lg" type="password" autoComplete="new-password" minLength={8} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input id="confirmPassword" name="confirmPassword" size="lg" type="password" autoComplete="new-password" minLength={8} required />
          </div>

          {erro && PASSWORD_ERROR_MESSAGES[erro] && (
            <p role="alert" className="text-sm text-destructive">
              {PASSWORD_ERROR_MESSAGES[erro]}
            </p>
          )}
          {senha === "ok" && <p className="text-sm text-success">Senha alterada com sucesso.</p>}

          <Button type="submit" size="lg" className="self-start">
            Trocar senha
          </Button>
        </form>
      </Card>
    </div>
  );
}
