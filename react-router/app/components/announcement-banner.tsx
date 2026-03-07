import { useFetcher } from "react-router";
import { X } from "lucide-react";

type AnnouncementItem = {
  id: string;
  title: string;
  message: string;
  type: string;
  dismissible: boolean;
};

interface AnnouncementBannerProps {
  announcements: AnnouncementItem[];
  basePrefix: string;
}

const TYPE_STYLES: Record<string, string> = {
  INFO: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100",
  WARNING:
    "bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-100",
  CRITICAL:
    "bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-100",
};

function AnnouncementItem({ announcement }: { announcement: AnnouncementItem }) {
  const fetcher = useFetcher();
  const isDismissed = fetcher.state !== "idle";

  if (isDismissed) return null;

  const styles = TYPE_STYLES[announcement.type] ?? TYPE_STYLES.INFO;

  return (
    <div className={`w-full border-b px-4 py-2.5 ${styles}`}>
      <div className="mx-auto flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm">{announcement.title}</span>
          {announcement.message && (
            <span className="text-sm ml-2">{announcement.message}</span>
          )}
        </div>
        {announcement.dismissible && (
          <fetcher.Form method="POST" action="/resources/dismiss-announcement">
            <input type="hidden" name="announcementId" value={announcement.id} />
            <button
              type="submit"
              className="shrink-0 rounded-sm p-0.5 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss announcement"
            >
              <X className="size-4" />
            </button>
          </fetcher.Form>
        )}
      </div>
    </div>
  );
}

export function AnnouncementBanner({ announcements, basePrefix }: AnnouncementBannerProps) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <div className="w-full">
      {announcements.map((announcement) => (
        <AnnouncementItem key={announcement.id} announcement={announcement} />
      ))}
    </div>
  );
}
