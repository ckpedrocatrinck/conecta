import { withTenant } from "../db/with-tenant";
import { findActiveTenants } from "../repositories/tenant.repository";
import { findDueScheduledAnnouncements } from "../repositories/announcement.repository";
import { recordAuditLog } from "../repositories/audit-log.repository";
import { publishAnnouncement } from "./publish";

export type ScheduledSweepResult = {
  published: { tenantId: string; announcementId: string; seqNumber: number; year: number }[];
};

/**
 * Publica todo `scheduled` cujo publishAt já passou, tenant por tenant.
 * `findActiveTenants()` (tenant.repository.ts) é o único ponto legítimo de
 * enumeração cross-tenant (tenants não tem RLS por tenant_id — é a raiz da
 * hierarquia). Cada publicação em si roda isolada dentro de um `withTenant`
 * por tenant, reaproveitando o mesmo `publishAnnouncement()` usado pela
 * Server Action "Publicar agora" — mesma proteção de corrida nos dois casos.
 */
export async function runScheduledAnnouncementSweep(now: Date = new Date()): Promise<ScheduledSweepResult> {
  const tenants = await findActiveTenants();
  const published: ScheduledSweepResult["published"] = [];

  for (const tenant of tenants) {
    await withTenant({ tenantId: tenant.id }, async (tx) => {
      const due = await findDueScheduledAnnouncements(tx, tenant.id, now);
      for (const announcement of due) {
        const result = await publishAnnouncement(tx, { tenantId: tenant.id, announcementId: announcement.id });
        if (result.status === "published") {
          await recordAuditLog(tx, {
            tenantId: tenant.id,
            actorUserId: null,
            action: "announcement.publish_scheduled",
            entity: "Announcement",
            entityId: announcement.id,
            metadata: { seqNumber: result.seqNumber, year: result.year },
          });
          published.push({ tenantId: tenant.id, announcementId: announcement.id, seqNumber: result.seqNumber, year: result.year });
        }
      }
    });
  }

  return { published };
}
