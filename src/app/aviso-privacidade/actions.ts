"use server";

import { redirect } from "next/navigation";
import { requireSession } from "../../lib/auth/session";
import { withTenant } from "../../lib/db/with-tenant";
import { acceptPrivacyNotice } from "../../lib/repositories/user.repository";
import { PRIVACY_NOTICE_VERSION } from "../../lib/privacy/notice";

export async function acceptPrivacyNoticeAction() {
  const session = await requireSession();

  await withTenant({ tenantId: session.tenantId }, (tx) =>
    acceptPrivacyNotice(tx, session.userId, PRIVACY_NOTICE_VERSION),
  );

  redirect("/");
}
