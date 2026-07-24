import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import {
  findTenantBranding,
  findTenantHomeBannerKey,
} from "@/lib/repositories/tenant.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import { DEFAULT_ACCENT_COLOR } from "@/lib/cards/brand-tokens";
import { AppearanceUploader } from "./appearance-uploader";
import { AccentColorField } from "./accent-color-field";

// Arte fixa servida quando o tenant nao configurou banner (mesma usada na home
// do colaborador — ver page.tsx da home). Preview mostra o que o colaborador ve.
const DEFAULT_BANNER_SRC = "/banners/home.png";

export default async function AparenciaPage() {
  const session = await requireAdmin();

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
          Banner da home, logo e cor de destaque da sua empresa. Cada mudança é
          salva ao concluir.
        </p>
      </div>

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
          previewClassName="h-auto w-full rounded-[var(--radius-card)] border border-border bg-muted object-contain"
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
        <AccentColorField initialColor={accentColor} />
      </Card>
    </div>
  );
}
