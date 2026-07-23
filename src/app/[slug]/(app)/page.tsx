import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Check, MessageSquareHeart } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { HomeBanner } from "@/components/home/home-banner";
import { PostCard } from "@/components/feed/post-card";
import { FeedLoadMore } from "@/components/feed/load-more";
import { CardTemplate } from "@/components/cards/templates";
import { requireOnboardedSession } from "@/lib/auth/session";
import { withTenant } from "@/lib/db/with-tenant";
import { findUserById, findUpcomingBirthdays } from "@/lib/repositories/user.repository";
import { listAnnouncementsForUser } from "@/lib/announcements/list-for-user";
import { formatAnnouncementCode } from "@/lib/announcements/publish";
import { findUnreadNotificationsForUser, markNotificationRead } from "@/lib/repositories/notification.repository";
import { findPostsForFeed } from "@/lib/repositories/post.repository";
import { findOpenJobOpeningsForEmployee } from "@/lib/repositories/job-opening.repository";
import { findActiveBenefitsForEmployee } from "@/lib/repositories/benefit.repository";
import { findTenantBranding } from "@/lib/repositories/tenant.repository";
import { buildFeedCards, FEED_PAGE_SIZE } from "@/lib/feed/build-feed-view";
import { birthdayWindowMonthDays } from "@/lib/dates/birthday-window";
import { buildBirthdayListView, buildTodaysBirthdayCards } from "@/lib/birthdays/build-birthday-view";
import { jobOpeningToCardData } from "@/lib/jobs/build-job-opening-view";
import { Gift } from "lucide-react";

const HOME_JOB_OPENINGS_LIMIT = 3;

export default async function Home() {
  const session = await requireOnboardedSession();
  const now = new Date();
  const todayMonthDay = birthdayWindowMonthDays(now, 0);
  const [{ user, notifications, feedPosts, birthdayRows, openJobs, benefits, pendingAnnouncements }, branding] = await Promise.all([
    withTenant({ tenantId: session.tenantId }, async (tx) => ({
      user: await findUserById(tx, session.tenantId, session.userId),
      notifications: await findUnreadNotificationsForUser(tx, session.tenantId, session.userId),
      feedPosts: await findPostsForFeed(tx, session.tenantId, { limit: FEED_PAGE_SIZE }),
      birthdayRows: await findUpcomingBirthdays(tx, session.tenantId, todayMonthDay),
      openJobs: await findOpenJobOpeningsForEmployee(tx, session.tenantId, { now }),
      benefits: await findActiveBenefitsForEmployee(tx, session.tenantId),
      // Itens que exigem ciencia do usuario (mesmo estado do badge de navegacao,
      // aqui com o comunicado em si para o card acionavel da home — protótipo
      // "Ler e confirmar"). So' apresentacao: a lista reusa o mesmo calculo de
      // reader-state, sem tocar em nenhum fluxo.
      pendingAnnouncements: (
        await listAnnouncementsForUser(tx, session.tenantId, session.userId)
      ).items.filter((i) => i.state.awaitingAck),
    })),
    findTenantBranding(session.tenantId),
  ]);

  const feedCards = await buildFeedCards(feedPosts, session.userId);
  const lastFeedCard = feedCards.at(-1);
  const feedInitialCursor =
    feedCards.length === FEED_PAGE_SIZE && lastFeedCard
      ? { eventDate: lastFeedCard.eventDate, createdAt: lastFeedCard.createdAt, id: lastFeedCard.id }
      : null;

  const todaysBirthdayEntries = await buildBirthdayListView(birthdayRows, todayMonthDay);
  const todaysBirthdayCards = buildTodaysBirthdayCards(todaysBirthdayEntries, now.toISOString(), branding);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-card-title font-extrabold tracking-tight text-primary-deep">Conecta</h1>
          <p className="text-meta text-muted-foreground">
            Bem-vindo(a), {user?.fullName ?? "colaborador(a)"}.
          </p>
        </div>
        <Link href={`/${session.tenantSlug}/perfil`} aria-label="Meu perfil" className="shrink-0 rounded-full">
          <Avatar name={user?.fullName ?? "?"} size="md" />
        </Link>
      </div>

      <HomeBanner
        imageSrc="/banners/home.png"
        imageAlt="Comunicação que conecta. Informação que transforma. Aqui a informação chega, a equipe se engaja e todos crescem juntos."
        title="Comunicação que conecta."
        subtitle="Informação que transforma."
      />

      {pendingAnnouncements.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-action-border bg-action-subtle p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 text-body font-semibold text-action-deep">
            <AlertTriangle className="size-5 shrink-0" aria-hidden="true" />
            <span>
              {pendingAnnouncements.length} comunicado{pendingAnnouncements.length > 1 ? "s" : ""} aguarda
              {pendingAnnouncements.length > 1 ? "m" : ""} sua ciência
            </span>
          </div>
          {(() => {
            const [{ announcement, latestVersion }] = pendingAnnouncements;
            const code =
              announcement.seqNumber != null && announcement.year != null
                ? `${formatAnnouncementCode(announcement.seqNumber, announcement.year)} · `
                : "";
            return (
              <>
                <p className="text-card-title font-bold text-foreground">
                  {code}
                  {latestVersion.title}
                </p>
                <Link
                  href={`/${session.tenantSlug}/comunicados/${announcement.id}`}
                  className={`${buttonVariants({ variant: "action", size: "xl" })} w-full`}
                >
                  <Check aria-hidden="true" />
                  Ler e confirmar
                </Link>
                {pendingAnnouncements.length > 1 && (
                  <Link
                    href={`/${session.tenantSlug}/comunicados`}
                    className="text-meta font-semibold text-action-deep underline-offset-4 hover:underline"
                  >
                    Ver todos os {pendingAnnouncements.length} pendentes
                  </Link>
                )}
              </>
            );
          })()}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <form
              key={n.id}
              action={async () => {
                "use server";
                await withTenant({ tenantId: session.tenantId }, (tx) =>
                  markNotificationRead(tx, session.tenantId, session.userId, n.id),
                );
                redirect(n.announcementId ? `/${session.tenantSlug}/comunicados/${n.announcementId}` : `/${session.tenantSlug}/comunicados`);
              }}
            >
              <button
                type="submit"
                className="w-full rounded-[var(--radius-card)] border border-border bg-card px-4 py-3 text-left text-body font-medium text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
              >
                {n.message}
              </button>
            </form>
          ))}
        </div>
      )}

      {todaysBirthdayCards.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-card-title font-bold text-foreground">Aniversariantes de hoje</h2>
            <Link href={`/${session.tenantSlug}/aniversariantes`} className="text-meta font-semibold text-primary underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {todaysBirthdayCards.map(({ userId, card }) => (
            <CardTemplate key={userId} data={card} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-card-title font-bold text-foreground">Feed</h2>
        {feedCards.length === 0 ? (
          <EmptyState
            icon={MessageSquareHeart}
            title="Nenhuma novidade por aqui ainda"
            description="Reconhecimentos, tempo de casa e promoções vão aparecer aqui assim que forem publicados."
          />
        ) : (
          <>
            {feedCards.map((post) => (
              <PostCard key={post.id} post={post} branding={branding} />
            ))}
            <FeedLoadMore initialCursor={feedInitialCursor} pageSize={FEED_PAGE_SIZE} branding={branding} />
          </>
        )}
      </div>

      {openJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-card-title font-bold text-foreground">Vagas abertas</h2>
            <Link href={`/${session.tenantSlug}/vagas`} className="text-meta font-semibold text-primary underline-offset-4 hover:underline">
              Ver todas
            </Link>
          </div>
          {openJobs.slice(0, HOME_JOB_OPENINGS_LIMIT).map((job) => (
            <Link key={job.id} href={`/${session.tenantSlug}/vagas/${job.id}`}>
              <CardTemplate data={jobOpeningToCardData(job, branding)} />
            </Link>
          ))}
        </div>
      )}

      {benefits.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-card-title font-bold text-foreground">Clube de Benefícios</h2>
            <Link href={`/${session.tenantSlug}/beneficios`} className="text-meta font-semibold text-primary underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {/* Card-chamada (descoberta) — convite enxuto, NAO a lista (que vive em
              /beneficios, tambem acessivel pelo icone do bottom nav). O card serve
              descoberta no comeco do piloto; o icone serve acesso intencional. */}
          <Link
            href={`/${session.tenantSlug}/beneficios`}
            className="flex items-center gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-muted"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <Gift className="size-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-semibold text-foreground">Clube de Benefícios</span>
              <span className="text-meta text-muted-foreground">Descontos e vantagens da empresa para você.</span>
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
