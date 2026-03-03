import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { getTOTPAuthUri } from "@epic-web/totp";
import { data, Form, Link, redirect, useActionData, useLoaderData, useParams } from "react-router";
import { Check, Copy, KeyRound, Shield } from "lucide-react";
import * as QRCode from "qrcode";
import { useState } from "react";
import { z } from "zod/v4";
import { twoFAVerificationType, twoFAVerifyVerificationType } from "~/lib/2fa-constants";
import { prisma } from "~/lib/db.server";
import { env } from "~/lib/env.server";
import { isFeatureEnabled, FEATURE_FLAG_KEYS } from "~/lib/feature-flags.server";
import { requireUserId } from "~/lib/session.server";
import { isCodeValid } from "~/lib/verification.server";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Route } from "./+types/verify";

export const handle = { breadcrumb: "Verify Setup" };

const verifySchema = z.object({
  code: z.string().min(6, "Code must be 6 digits").max(6, "Code must be 6 digits"),
  intent: z.enum(["verify", "cancel"]),
});

export async function loader({ request, params }: Route.LoaderArgs) {
  const twoFAFlagEnabled = await isFeatureEnabled(FEATURE_FLAG_KEYS.TWO_FACTOR);
  if (!twoFAFlagEnabled) {
    throw redirect(`/${params.tenant}/profile`);
  }

  const userId = await requireUserId(request);

  const verification = await prisma.verification.findUnique({
    where: {
      target_type: {
        target: userId,
        type: twoFAVerifyVerificationType,
      },
    },
    select: {
      id: true,
      algorithm: true,
      secret: true,
      period: true,
      digits: true,
    },
  });

  if (!verification || !verification.secret) {
    throw redirect(".");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true },
  });

  const issuer = new URL(env.BASE_URL).host;

  const otpUri = getTOTPAuthUri({
    ...verification,
    accountName: user.email,
    issuer,
  });

  const qrCode = await QRCode.toDataURL(otpUri);

  return {
    qrCode,
    secret: verification.secret,
    issuer,
    email: user.email,
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  const userId = await requireUserId(request);
  const formData = await request.formData();

  if (formData.get("intent") === "cancel") {
    await prisma.verification.deleteMany({
      where: { type: twoFAVerifyVerificationType, target: userId },
    });
    return redirect(`/${params.tenant}/profile/two-factor`);
  }

  const submission = parseWithZod(formData, { schema: verifySchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;

  const valid = await isCodeValid({
    code,
    type: twoFAVerifyVerificationType,
    target: userId,
    deleteOnSuccess: false,
  });

  if (!valid) {
    return data(
      submission.reply({
        fieldErrors: { code: ["Invalid code. Please check and try again."] },
      }),
      { status: 400 },
    );
  }

  // Activate 2FA -- change type from 2fa-verify to 2fa, remove expiry
  await prisma.verification.update({
    where: {
      target_type: {
        target: userId,
        type: twoFAVerifyVerificationType,
      },
    },
    data: {
      type: twoFAVerificationType,
      expiresAt: new Date("2099-12-31T23:59:59Z"),
    },
  });

  // Audit log
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, tenantId: true },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      tenantId: user?.tenantId,
      action: "TWO_FACTOR_ENABLE",
      entityType: "User",
      entityId: userId,
      description: `Two-factor authentication enabled for ${user?.email}`,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return redirect(`/${params.tenant}/profile/two-factor`);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? (
        <>
          <Check className="mr-2 h-4 w-4" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          Copy
        </>
      )}
    </Button>
  );
}

export default function TwoFactorVerifyPage({ actionData }: Route.ComponentProps) {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();

  const [form, fields] = useForm({
    lastResult: actionData,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifySchema });
    },
    shouldRevalidate: "onBlur",
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Set Up Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with your authenticator app to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Scan QR Code */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                1
              </div>
              <p className="font-medium">Scan the QR code with your authenticator app</p>
            </div>

            <Tabs defaultValue="qr" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="qr">QR Code</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>

              <TabsContent value="qr" className="mt-4">
                <div className="flex flex-col items-center space-y-4">
                  <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 bg-white p-4">
                    <img
                      alt="QR code for 2FA setup"
                      src={loaderData.qrCode}
                      className="h-48 w-48"
                    />
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Open your authenticator app and scan this QR code
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    If you can&apos;t scan the QR code, manually enter this information in your
                    authenticator app:
                  </p>

                  <div className="space-y-3">
                    <div className="rounded-lg border bg-muted/50 p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Account</p>
                      <p className="font-mono text-sm">{loaderData.email}</p>
                    </div>

                    <div className="rounded-lg border bg-muted/50 p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Issuer</p>
                      <p className="font-mono text-sm">{loaderData.issuer}</p>
                    </div>

                    <div className="rounded-lg border bg-muted/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            Secret Key
                          </p>
                          <p className="break-all font-mono text-sm">{loaderData.secret}</p>
                        </div>
                        <CopyButton text={loaderData.secret} />
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Step 2: Enter Code */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                2
              </div>
              <p className="font-medium">Enter the 6-digit verification code</p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  After adding the account, your authenticator app will show a 6-digit code that
                  changes every 30 seconds. Enter the current code below.
                </p>
              </div>
            </div>

            <Form method="POST" {...getFormProps(form)}>
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor={fields.code.id}>Verification Code</Label>
                  {(() => {
                    const { key, ...codeProps } = getInputProps(fields.code, {
                      type: "text",
                    });
                    return (
                      <Input
                        key={key}
                        {...codeProps}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                        className="text-center text-lg tracking-widest"
                      />
                    );
                  })()}
                  {fields.code.errors && (
                    <p className="text-sm text-destructive">{fields.code.errors[0]}</p>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button type="submit" name="intent" value="verify" className="flex-1">
                    Verify &amp; Enable 2FA
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to={`/${params.tenant}/profile/two-factor`}>Cancel</Link>
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
