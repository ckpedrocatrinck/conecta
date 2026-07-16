"use server";

import { requireOnboardedSession } from "../../../lib/auth/session";
import { withTenant } from "../../../lib/db/with-tenant";
import {
  deletePushSubscriptionById,
  savePushSubscription,
  type PushSubscriptionKeys,
} from "../../../lib/repositories/push-subscription.repository";

export async function saveOwnPushSubscriptionAction(subscription: { endpoint: string; keys: PushSubscriptionKeys }) {
  const session = await requireOnboardedSession();
  await withTenant({ tenantId: session.tenantId }, (tx) =>
    savePushSubscription(tx, {
      tenantId: session.tenantId,
      userId: session.userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    }),
  );
}

export async function revokeOwnPushSubscriptionAction(id: string) {
  const session = await requireOnboardedSession();
  await withTenant({ tenantId: session.tenantId }, (tx) =>
    deletePushSubscriptionById(tx, session.tenantId, session.userId, id),
  );
}
