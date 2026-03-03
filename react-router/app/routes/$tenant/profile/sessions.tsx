import { Form, Link, redirect, useLoaderData, useParams } from "react-router";
import { ArrowLeft, Monitor, LogOut, ShieldCheck } from "lucide-react";
import { prisma } from "~/lib/db.server";
import { requireUserId, getSession } from "~/lib/session.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import type { Route } from "./+types/sessions";

export const handle = { breadcrumb: "Active Sessions" };

export async function loader({ request }: Route.LoaderArgs) {
  const userId = await requireUserId(request);
  const cookieSession = await getSession(request);
  const currentSessionId = cookieSession.get("sessionId") as string;

  const sessions = await prisma.session.findMany({
    where: { userId, expirationDate: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      expirationDate: true,
    },
  });

  return {
    sessions: sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      expirationDate: s.expirationDate.toISOString(),
      isCurrent: s.id === currentSessionId,
    })),
    totalCount: sessions.length,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const cookieSession = await getSession(request);
  const currentSessionId = cookieSession.get("sessionId") as string;

  if (intent === "sign-out-others") {
    await prisma.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });

    await prisma.auditLog.create({
      data: {
        action: "LOGOUT",
        entityType: "Session",
        userId,
        description: "Signed out of all other sessions",
        ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
        userAgent: request.headers.get("user-agent") ?? undefined,
      },
    });
  } else if (intent === "sign-out-session") {
    const sessionId = formData.get("sessionId");
    if (typeof sessionId === "string" && sessionId !== currentSessionId) {
      await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});

      await prisma.auditLog.create({
        data: {
          action: "LOGOUT",
          entityType: "Session",
          entityId: sessionId,
          userId,
          description: "Signed out of a specific session",
          ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
          userAgent: request.headers.get("user-agent") ?? undefined,
        },
      });
    }
  }

  return redirect(`/${params.tenant}/profile/sessions`);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionsPage() {
  const { sessions, totalCount } = useLoaderData<typeof loader>();
  const params = useParams();
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to={`/${params.tenant}/profile`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Active Sessions</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your active sessions across devices. {totalCount} active{" "}
            {totalCount === 1 ? "session" : "sessions"}.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Sessions
          </CardTitle>
          <CardDescription>
            These are the devices that are currently logged in to your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessions.map((session, index) => (
            <div key={session.id}>
              {index > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                    {session.isCurrent ? (
                      <ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {session.isCurrent ? "Current Session" : "Session"}
                      </p>
                      {session.isCurrent && (
                        <Badge variant="secondary" className="text-xs">
                          This device
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Started {formatDate(session.createdAt)} &middot; Expires{" "}
                      {formatDate(session.expirationDate)}
                    </p>
                  </div>
                </div>
                {!session.isCurrent && (
                  <Form method="post">
                    <input type="hidden" name="intent" value="sign-out-session" />
                    <input type="hidden" name="sessionId" value={session.id} />
                    <Button variant="outline" size="sm" type="submit">
                      <LogOut className="mr-1.5 h-3.5 w-3.5" />
                      Sign Out
                    </Button>
                  </Form>
                )}
              </div>
            </div>
          ))}

          {otherSessions.length > 0 && (
            <>
              <Separator />
              <Form method="post">
                <input type="hidden" name="intent" value="sign-out-others" />
                <Button variant="outline" type="submit">
                  <LogOut className="mr-1.5 h-4 w-4" />
                  Sign Out of All Other Sessions
                </Button>
              </Form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
