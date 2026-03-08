import { data, redirect, useActionData, useLoaderData, Form, Link } from "react-router";

export const handle = { breadcrumb: "Edit Announcement" };

import { requireAnyRole } from "~/utils/auth/require-auth.server";
import { ADMIN_OR_TENANT_ADMIN } from "~/utils/auth/roles";
import { getAnnouncement, updateAnnouncement } from "~/services/announcements.server";
import { handleServiceError } from "~/utils/errors/handle-service-error.server";
import { buildServiceContext } from "~/utils/request-context.server";
import { useBasePrefix } from "~/hooks/use-base-prefix";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { DateTimePicker } from "~/components/ui/date-time-picker";
import { NativeSelect, NativeSelectOption } from "~/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import type { Route } from "./+types/edit";

export async function loader({ request, params }: Route.LoaderArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) throw new Response("No tenant", { status: 403 });

  const announcement = await getAnnouncement(params.announcementId, tenantId);
  return { announcement };
}

export async function action({ request, params }: Route.ActionArgs) {
  const { user } = await requireAnyRole(request, [...ADMIN_OR_TENANT_ADMIN]);
  const tenantId = user.tenantId;
  if (!tenantId) return data({ error: "No tenant" }, { status: 403 });

  const formData = await request.formData();
  const title = formData.get("title") as string;
  const message = formData.get("message") as string;
  const type = (formData.get("type") as "INFO" | "WARNING" | "CRITICAL") || "INFO";
  const active = formData.get("active") === "on";
  const dismissible = formData.get("dismissible") === "on";
  const startsAtRaw = formData.get("startsAt") as string;
  const endsAtRaw = formData.get("endsAt") as string;

  if (!title) return data({ error: "Title is required" }, { status: 400 });
  if (!message) return data({ error: "Message is required" }, { status: 400 });

  const ctx = buildServiceContext(request, user, tenantId);

  try {
    await updateAnnouncement(
      params.announcementId,
      {
        title,
        message,
        type,
        active,
        dismissible,
        startsAt: startsAtRaw ? new Date(startsAtRaw) : undefined,
        endsAt: endsAtRaw ? new Date(endsAtRaw) : null,
      },
      ctx,
    );
    return redirect(`/${params.tenant}/settings/announcements`);
  } catch (error) {
    return handleServiceError(error);
  }
}

export default function EditAnnouncementPage() {
  const { announcement } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const base = useBasePrefix();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Edit Announcement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update the announcement details.
        </p>
      </div>

      {actionData && "error" in actionData && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {actionData.error}
        </div>
      )}

      <Form method="post" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Announcement Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  defaultValue={announcement.title}
                  placeholder="Announcement title"
                  required
                  className="w-full"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Type</Label>
                <NativeSelect
                  id="type"
                  name="type"
                  defaultValue={announcement.type}
                  className="w-full"
                >
                  <NativeSelectOption value="INFO">Info</NativeSelectOption>
                  <NativeSelectOption value="WARNING">Warning</NativeSelectOption>
                  <NativeSelectOption value="CRITICAL">Critical</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="message">Message</Label>
              <textarea
                id="message"
                name="message"
                defaultValue={announcement.message}
                placeholder="Announcement message"
                required
                rows={3}
                className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule & Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Starts At</Label>
                <DateTimePicker
                  name="startsAt"
                  defaultValue={announcement.startsAt ? new Date(announcement.startsAt) : undefined}
                  placeholder="Pick start date & time"
                />
              </div>
              <div className="grid gap-2">
                <Label>Ends At (optional)</Label>
                <DateTimePicker
                  name="endsAt"
                  defaultValue={announcement.endsAt ? new Date(announcement.endsAt) : undefined}
                  placeholder="Pick end date & time"
                />
              </div>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox name="active" defaultChecked={announcement.active} />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox name="dismissible" defaultChecked={announcement.dismissible} />
                Dismissible
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto">
            Save Changes
          </Button>
          <Button type="button" variant="outline" asChild className="w-full sm:w-auto">
            <Link to={`${base}/settings/announcements`}>Cancel</Link>
          </Button>
        </div>
      </Form>
    </div>
  );
}
