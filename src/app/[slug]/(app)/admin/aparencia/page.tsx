import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import { requireAdmin } from "@/lib/auth/session";
import {
  findTenantBranding,
  findTenantHomeBannerKey,
} from "@/lib/repositories/tenant.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import { DEFAULT_ACCENT_COLOR } from "@/lib/cards/brand-tokens";
import { AppearanceUploader } from "./appearance-uploader";
import { updateAccentColorAction } from "./actions";

// Arte fixa servida quando o tenant nao configurou banner (mesma usada na home
// do colaborador — ver page.tsx da home). Preview mostra o que o colaborador ve.
const DEFAULT_BANNER_SRC = "/banners/home.png";

const ERROR_MESSAGES: Record<string, string> = {
  cor: "Cor inválida. Use o seletor (formato #RRGGBB).",
};
const SUCCESS_MESSAGES: Record<string, string> = {
  cor: "Cor de destaque salva.",
};

export default async function AparenciaPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const { erro, ok } = await searchParams;

  const [branding, bannerKey] = await Promise.all([
    findTenantBranding(session.tenantId),
    findTenantHomeBannerKey(session.tenantId),
  ]);

  const bannerUrl = bannerKey ? await mediaStorage.getViewUrl(bannerKey) : null;
  const logoUrl = branding.logoUrl ? await mediaStorage.getViewUrl(branding.logoUrl) : null;
  const accentColor = branding.accentColor ?? DEFAULT_ACCENT_COLOR;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-display text-foreground">Aparência da empresa</h1>
        <p className="text-meta text-muted-foreground">
          Banner da home, logo e cor de destaque da sua empresa.
        </p>
      </div>

      {erro && ERROR_MESSAGES[erro] && (
        <p role="alert" className="text-meta text-destructive">{ERROR_MESSAGES[erro]}</p>
      )}
      {ok && SUCCESS_MESSAGES[ok] && <p className="text-meta font-medium text-success">{SUCCESS_MESSAGES[ok]}</p>}

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Banner da home</h2>
          <p className="text-meta text-muted-foreground">
            Imagem exibida no topo da tela inicial. O texto faz parte da imagem.
            Sem um banner próprio, a arte padrão é usada.
          </p>
        </div>
        <AppearanceUploader
          target="banner"
          currentUrl={bannerUrl ?? DEFAULT_BANNER_SRC}
          previewClassName="h-40 w-full rounded-[var(--radius-card)] border border-border object-cover"
          buttonLabel={bannerUrl ? "Trocar banner" : "Enviar banner"}
        />
      </Card>

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Logo</h2>
          <p className="text-meta text-muted-foreground">
            Aparece nos cards gerados (reconhecimentos, vagas) e no card baixável.
          </p>
        </div>
        <AppearanceUploader
          target="logo"
          currentUrl={logoUrl}
          previewClassName="h-16 w-40 rounded-lg border border-border bg-card object-contain p-2"
          buttonLabel={logoUrl ? "Trocar logo" : "Enviar logo"}
        />
      </Card>

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Cor de destaque</h2>
          <p className="text-meta text-muted-foreground">
            Acento dos cards da empresa. Não substitui o laranja de ações nem a
            marca do produto.
          </p>
        </div>
        <form action={updateAccentColorAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accentColor">Cor</Label>
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              defaultValue={accentColor}
              className="h-11 w-20 cursor-pointer rounded-md border border-border bg-card p-1"
            />
          </div>
          <SubmitButton size="touch" variant="secondary" pendingLabel="Salvando…">
            Salvar cor
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}
