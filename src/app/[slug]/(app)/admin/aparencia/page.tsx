import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import {
  findTenantBeneficiosBannerKey,
  findTenantBranding,
  findTenantHomeBannerKey,
  findTenantVagasBannerKey,
} from "@/lib/repositories/tenant.repository";
import { mediaStorage } from "@/lib/storage/media-storage";
import { DEFAULT_ACCENT_COLOR } from "@/lib/cards/brand-tokens";
import { HOME_BANNER_IMAGE_CLASSNAME } from "@/components/home/home-banner";
import { AppearanceUploader } from "./appearance-uploader";
import { AccentColorField } from "./accent-color-field";

// Arte fixa servida quando o tenant nao configurou banner (mesma usada na home
// do colaborador — ver page.tsx da home). Preview mostra o que o colaborador ve.
const DEFAULT_BANNER_SRC = "/banners/home.png";
// Idem, para Vagas (INC-019) — a arte fixa que /vagas usa quando o tenant nao
// configurou banner proprio.
const DEFAULT_VAGAS_BANNER_SRC = "/banners/vagas.png";

// Padrão de banner definido pelo Pedro (INC-027 Bloco 3.8): 1920×650px
// (≈2,95:1) — a orientação aqui precisa concordar EXATAMENTE com o
// aspect-ratio usado em home-banner.tsx (HOME_BANNER_IMAGE_CLASSNAME); a
// divergência entre os dois foi a causa raiz dos dois ciclos anteriores
// neste mesmo componente. Nenhuma das 3 artes padrão do produto hoje bate
// com essa proporção (home.png 1.874:1, vagas.png 2:1, clube.png 1.777:1)
// — todas sofrem recorte de 32-40% até serem refeitas/recortadas.
const BANNER_SIZE_HINT = (
  <p className="rounded-[var(--radius-card)] border border-border bg-primary-subtle px-3 py-2 text-meta text-foreground-soft">
    <span className="font-semibold text-foreground">Tamanho recomendado: 1920×650px (≈3:1) — banner bem mais largo que alto.</span>{" "}
    Mantenha o essencial (texto, logo, pessoas) <span className="font-semibold">centralizado</span> —
    áreas nas bordas podem ser cortadas em telas diferentes.
  </p>
);

// Derivado de onde a logo é DE FATO consumida (não é um tamanho inventado):
// card-shell.tsx renderiza em altura fixa (h-6) + largura livre (object-contain,
// nunca corta); o card exportável via satori (card-image-shell.tsx) usa uma
// caixa fixa de 120×40px (proporção 3:1) com objectFit "contain" — uma logo
// muito quadrada ou vertical fica pequena dentro dela, sobrando espaço vazio
// nas laterais. `object-contain` nunca corta a logo (diferente do banner,
// que usa object-cover) — a orientação aqui é sobre aproveitamento do
// espaço, não sobre recorte.
const LOGO_SIZE_HINT = (
  <p className="rounded-[var(--radius-card)] border border-border bg-primary-subtle px-3 py-2 text-meta text-foreground-soft">
    <span className="font-semibold text-foreground">Formato horizontal, proporção próxima de 3:1 (ex.: 480×160px).</span>{" "}
    PNG com fundo transparente combina com qualquer cor de card — a logo nunca é
    cortada, mas fica pequena se for muito quadrada ou vertical.
  </p>
);

// Preview FIEL: reaproveita a MESMA classe do banner ao vivo (home-banner.tsx)
// — o admin ve o recorte real, nao a arte inteira (INC-027 Bloco 3.6: duas
// strings de classe duplicadas podiam divergir silenciosamente).
const BANNER_PREVIEW_CLASSNAME = HOME_BANNER_IMAGE_CLASSNAME;

export default async function AparenciaPage() {
  const session = await requireAdmin();

  const [branding, bannerKey, vagasBannerKey, beneficiosBannerKey] = await Promise.all([
    findTenantBranding(session.tenantId),
    findTenantHomeBannerKey(session.tenantId),
    findTenantVagasBannerKey(session.tenantId),
    findTenantBeneficiosBannerKey(session.tenantId),
  ]);

  // Preview do admin: mostra a key REAL do tenant (ou nada) — nunca a arte
  // fixa de outra secao como se fosse a configurada (diferente da resolucao
  // usada nas telas publicas, que cai no fallback certo de cada secao).
  const bannerUrl = bannerKey ? await mediaStorage.getViewUrl(bannerKey) : null;
  const vagasBannerUrl = vagasBannerKey ? await mediaStorage.getViewUrl(vagasBannerKey) : null;
  const beneficiosBannerUrl = beneficiosBannerKey ? await mediaStorage.getViewUrl(beneficiosBannerKey) : null;
  const logoUrl = branding.logoUrl ? await mediaStorage.getViewUrl(branding.logoUrl) : null;
  const accentColor = branding.accentColor ?? DEFAULT_ACCENT_COLOR;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-display text-foreground">Aparência da empresa</h1>
        <p className="text-meta text-muted-foreground">
          Banners de cada tela, logo e cor de destaque da sua empresa. Cada
          mudança é salva ao concluir.
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
        {BANNER_SIZE_HINT}
        <AppearanceUploader
          target="banner"
          currentUrl={bannerUrl ?? DEFAULT_BANNER_SRC}
          previewClassName={BANNER_PREVIEW_CLASSNAME}
          buttonLabel={bannerUrl ? "Trocar banner" : "Enviar banner"}
        />
      </Card>

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Banner de Vagas</h2>
          <p className="text-meta text-muted-foreground">
            Imagem exibida no topo da tela de Vagas internas (colaborador e
            admin). Sem um banner próprio, a arte padrão do produto é usada.
          </p>
        </div>
        {BANNER_SIZE_HINT}
        <AppearanceUploader
          target="vagas-banner"
          currentUrl={vagasBannerUrl ?? DEFAULT_VAGAS_BANNER_SRC}
          previewClassName={BANNER_PREVIEW_CLASSNAME}
          buttonLabel={vagasBannerUrl ? "Trocar banner" : "Enviar banner"}
        />
      </Card>

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Banner de Benefícios</h2>
          <p className="text-meta text-muted-foreground">
            Imagem exibida no topo da tela de Clube de Benefícios (colaborador e
            admin). Sem um banner próprio, a tela mostra só o título — não há
            arte padrão para esta seção.
          </p>
        </div>
        {BANNER_SIZE_HINT}
        <AppearanceUploader
          target="beneficios-banner"
          currentUrl={beneficiosBannerUrl}
          previewClassName={BANNER_PREVIEW_CLASSNAME}
          buttonLabel={beneficiosBannerUrl ? "Trocar banner" : "Enviar banner"}
          emptyLabel="Sem imagem — a tela mostra só o texto"
        />
      </Card>

      <Card className="gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-card-title font-bold text-foreground">Logo</h2>
          <p className="text-meta text-muted-foreground">
            Aparece nos cards gerados (reconhecimentos, vagas) e no card baixável.
          </p>
        </div>
        {LOGO_SIZE_HINT}
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
