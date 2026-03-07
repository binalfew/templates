import { data } from "react-router";
import { requireUserId } from "~/utils/auth/session.server";
import { dismissAnnouncement } from "~/services/announcements.server";
import type { Route } from "./+types/dismiss-announcement";

export async function action({ request }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const announcementId = formData.get("announcementId") as string;

  if (!announcementId) {
    return data({ success: false }, { status: 400 });
  }

  await dismissAnnouncement(announcementId, userId);

  return data({ success: true });
}
