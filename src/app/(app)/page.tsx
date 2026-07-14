import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquareHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PendingBanner } from "@/components/ui/pending-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PostCard } from "@/components/feed/post-card";
import { FeedLoadMore } from "@/components/feed/load-more";
import { CardTemplate } from "@/components/cards/templates";
import { signOut } from "../../lib/auth/config";
import { requireOnboardedSession } from "../../lib/auth/session";
import { withTenant } from "../../lib/db/with-tenant";
import { findUserById, findUpcomingBirthdays } from "../../lib/repositories/user.repository";
import { getCachedPendingAckCount } from "../../lib/announcements/list-for-user";
import { findUnreadNotificationsForUser, markNotificationRead } from "../../lib/repositories/notification.repository";
import { findPostsForFeed } from "../../lib/repositories/post.repository";
import { findOpenJobOpeningsForEmployee } from "../../lib/repositories/job-opening.repository";
import { findTenantBranding } from "../../lib/repositories/tenant.repository";
import { buildFeedCards, FEED_PAGE_SIZE } from "../../lib/feed/build-feed-view";
import { birthdayWindowMonthDays } from "../../lib/dates/birthday-window";
import { buildBirthdayListView, buildTodaysBirthdayCards } from "../../lib/birthdays/build-birthday-view";
import { jobOpeningToCardData } from "../../lib/jobs/build-job-opening-view";

const HOME_JOB_OPENINGS_LIMIT = 3;

export default async function Home() {
  const session = await requireOnboardedSession();
  // getCachedPendingAckCount tambem e' chamada pelo layout de navegacao
  // (badge do item Comunicados) — cache() do React dedupe as duas chamadas
  // em uma unica consulta por request (INC-008.5).
  const pendingCount = await getCachedPendingAckCount(session.tenantId, session.userId);
  const now = new Date();
  const todayMonthDay = birthdayWindowMonthDays(now, 0);
  const [{ user, notifications, feedPosts, birthdayRows, openJobs }, branding] = await Promise.all([
    withTenant({ tenantId: session.tenantId }, async (tx) => ({
      user: await findUserById(tx, session.tenantId, session.userId),
      notifications: await findUnreadNotificationsForUser(tx, session.tenantId, session.userId),
      feedPosts: await findPostsForFeed(tx, session.tenantId, { limit: FEED_PAGE_SIZE }),
      birthdayRows: await findUpcomingBirthdays(tx, session.tenantId, todayMonthDay),
      openJobs: await findOpenJobOpeningsForEmployee(tx, session.tenantId, { now }),
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
    <div className="flex flex-1 flex-col gap-4 bg-zinc-50 px-4 py-6 dark:bg-black">
      <h1 className="text-2xl font-extrabold tracking-tight text-black dark:text-zinc-50">Conecta</h1>
      <p className="text-base text-zinc-600 dark:text-zinc-400">Bem-vindo(a), {user?.fullName ?? "colaborador(a)"}.</p>

      {pendingCount > 0 && (
        <PendingBanner
          message={`${pendingCount} comunicado${pendingCount > 1 ? "s" : ""} aguardando sua ciência`}
          action={
            <Link href="/comunicados" className="shrink-0 text-sm font-semibold text-action underline-offset-4 hover:underline">
              Ver
            </Link>
          }
        />
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
                redirect(n.announcementId ? `/comunicados/${n.announcementId}` : "/comunicados");
              }}
            >
              <button
                type="submit"
                className="w-full rounded-lg bg-action-subtle px-4 py-3 text-left text-sm font-medium text-foreground hover:bg-action-subtle/80"
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
            <h2 className="text-lg font-bold text-foreground">Aniversariantes de hoje</h2>
            <Link href="/aniversariantes" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Ver todos
            </Link>
          </div>
          {todaysBirthdayCards.map(({ userId, card }) => (
            <CardTemplate key={userId} data={card} />
          ))}
        </div>
      )}

      {openJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Vagas abertas</h2>
            <Link href="/vagas" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
              Ver todas
            </Link>
          </div>
          {openJobs.slice(0, HOME_JOB_OPENINGS_LIMIT).map((job) => (
            <Link key={job.id} href={`/vagas/${job.id}`}>
              <CardTemplate data={jobOpeningToCardData(job, branding)} />
            </Link>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Feed</h2>
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

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button type="submit" variant="secondary">
          Sair
        </Button>
      </form>
    </div>
  );
}
