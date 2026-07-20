import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/auth/config";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findUserById } from "@/lib/repositories/user.repository";
import { findBranchById } from "@/lib/repositories/branch.repository";
import { findMyJobApplications } from "@/lib/repositories/job-opening.repository";
import { findPushSubscriptionsForUser } from "@/lib/repositories/push-subscription.repository";
import { USER_ROLE_LABELS } from "@/lib/users/role-labels";
import { mediaStorage } from "@/lib/storage/media-storage";
import { formatDateTimeSaoPaulo } from "@/lib/dates/format-datetime";
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
  searchParams: Promise<{ erro?: string; senha?: string; consentimentos?: string }>;
}) {
  const session = await requireOnboardedSession();
  const { erro, senha, consentimentos } = await searchParams;

  const { user, branch, myApplications, pushSubscriptions } = await withTenant(
    { tenantId: session.tenantId },
    async (tx) => {
      const user = await findUserById(tx, session.tenantId, session.userId);
      return {
        user,
        branch: user ? await findBranchById(tx, session.tenantId, user.branchId) : null,
        myApplications: await findMyJobApplications(tx, session.tenantId, session.userId),
        pushSubscriptions: await findPushSubscriptionsForUser(tx, session.tenantId, session.userId),
      };
    },
  );
  if (!user) return null;

  const photoViewUrl = user.photoUrl ? await mediaStorage.getViewUrl(user.photoUrl) : null;
  const identity = [user.registrationCode, branch?.name, USER_ROLE_LABELS[user.role]]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-8">
      <h1 className="text-display text-foreground">Meus dados</h1>

      {/* Herói: foto + identidade + trocar foto */}
      <Card className="items-center gap-4">
        <PhotoUploader currentPhotoUrl={photoViewUrl} name={user.fullName}>
          <div className="flex flex-col gap-0.5">
            <p className="text-card-title font-bold text-foreground">{user.fullName}</p>
            <p className="text-meta text-muted-foreground">{identity}</p>
          </div>
        </PhotoUploader>
      </Card>

      <Card>
        <h2 className="text-card-title font-bold text-foreground">Dados cadastrais</h2>
        <div className="flex flex-col gap-1 text-body text-foreground">
          <p><span className="font-medium text-muted-foreground">Nome:</span> {user.fullName}</p>
          <p><span className="font-medium text-muted-foreground">Matrícula:</span> {user.registrationCode}</p>
          <p><span className="font-medium text-muted-foreground">Papel:</span> {USER_ROLE_LABELS[user.role]}</p>
          {user.phone && <p><span className="font-medium text-muted-foreground">Telefone:</span> {user.phone}</p>}
          {user.email && <p><span className="font-medium text-muted-foreground">E-mail:</span> {user.email}</p>}
        </div>
      </Card>

      <Card>
        <h2 className="text-card-title font-bold text-foreground">Minhas candidaturas</h2>
        {myApplications.length === 0 ? (
          <p className="text-meta text-muted-foreground">Você ainda não se candidatou a nenhuma vaga.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myApplications.map((application) => (
              <Link
                key={application.jobOpeningId}
                href={`/${session.tenantSlug}/vagas/${application.jobOpeningId}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-body transition-colors hover:bg-muted"
              >
                <span className="font-semibold text-foreground">{application.jobOpening.title}</span>
                <span className="shrink-0 text-meta text-muted-foreground">
                  {formatDateTimeSaoPaulo(application.createdAt)} ·{" "}
                  {JOB_STATUS_LABEL[application.jobOpening.status] ?? application.jobOpening.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="text-card-title font-bold text-foreground">Notificações push</h2>
        <PushOptIn subscriptions={pushSubscriptions} />
      </Card>

      <Card>
        <h2 className="text-card-title font-bold text-foreground">Consentimentos</h2>
        <form action={updateConsentAction} className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-body text-foreground">
            <Checkbox name="birthdayVisible" defaultChecked={user.birthdayVisible} />
            Exibir meu aniversário para os demais colaboradores
          </label>
          <label className="flex items-center gap-2.5 text-body text-foreground">
            <Checkbox name="photoVisible" defaultChecked={user.photoVisible} />
            Exibir minha foto para os demais colaboradores
          </label>
          {consentimentos === "ok" && <p className="text-meta font-medium text-success">Preferências salvas.</p>}

          <Button type="submit" variant="secondary" size="touch" className="self-start">
            Salvar consentimentos
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-card-title font-bold text-foreground">Trocar senha</h2>
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
            <p role="alert" className="text-meta text-destructive">
              {PASSWORD_ERROR_MESSAGES[erro]}
            </p>
          )}
          {senha === "ok" && <p className="text-meta font-medium text-success">Senha alterada com sucesso.</p>}

          <Button type="submit" size="touch" className="self-start">
            Trocar senha
          </Button>
        </form>
      </Card>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: `/${session.tenantSlug}/login` });
        }}
      >
        <Button type="submit" variant="destructive" size="touch" className="w-full">
          <LogOut aria-hidden="true" />
          Sair da conta
        </Button>
      </form>

      <p className="text-center text-meta text-subtle-foreground">
        Seus dados são tratados conforme a LGPD. Solicite acesso ou exclusão ao RH.
      </p>
    </div>
  );
}
