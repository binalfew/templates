import { useForm, getFormProps, getInputProps } from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { generateTOTP, getTOTPAuthUri } from "@epic-web/totp";
import { data, Form, redirect, useActionData, useLoaderData } from "react-router";
import { Check, Copy, KeyRound, Shield, ShieldAlert } from "lucide-react";
import * as QRCode from "qrcode";
import { useState } from "react";
import {
  twoFAVerificationType,
  twoFAVerifyVerificationType,
  unverifiedSessionIdKey,
} from "~/lib/auth/2fa-constants";
import { prisma } from "~/lib/db/db.server";
import { env } from "~/lib/config/env.server";
import {
  getVerifySession,
  isCodeValid,
  handleTwoFAVerification,
} from "~/lib/auth/verification.server";
import { generateRecoveryCodes } from "~/services/recovery-codes.server";
import { twoFASetupSchema as verifySchema } from "~/lib/schemas/auth";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Route } from "./+types/2fa-setup";

export async function loader({ request }: Route.LoaderArgs) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
    throw redirect("/auth/login");
  }

  // Get the user from the unverified session
  const dbSession = await prisma.session.findUnique({
    where: { id: unverifiedSessionId },
    select: { userId: true },
  });
  if (!dbSession) {
    throw redirect("/auth/login");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: dbSession.userId },
    select: { id: true, email: true },
  });

  // Generate or refresh a TOTP verification record for setup
  const { otp: _otp, ...config } = await generateTOTP();
  const verificationData = {
    ...config,
    type: twoFAVerifyVerificationType,
    target: user.id,
    userId: user.id,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  };

  await prisma.verification.upsert({
    where: {
      target_type: {
        type: twoFAVerifyVerificationType,
        target: user.id,
      },
    },
    update: verificationData,
    create: verificationData,
  });

  // Read back the verification to get the secret for QR code
  const verification = await prisma.verification.findUnique({
    where: {
      target_type: {
        target: user.id,
        type: twoFAVerifyVerificationType,
      },
    },
    select: {
      algorithm: true,
      secret: true,
      period: true,
      digits: true,
    },
  });

  if (!verification || !verification.secret) {
    throw redirect("/auth/login");
  }

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

export async function action({ request }: Route.ActionArgs) {
  const verifySession = await getVerifySession(request);
  const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey);
  if (!unverifiedSessionId) {
    throw redirect("/auth/login");
  }

  const dbSession = await prisma.session.findUnique({
    where: { id: unverifiedSessionId },
    select: { userId: true },
  });
  if (!dbSession) {
    throw redirect("/auth/login");
  }

  const formData = await request.formData();

  // Handle finalize intent — user has saved recovery codes, complete login
  if (formData.get("intent") === "finalize") {
    const redirectToValue = verifySession.get("redirectTo") as string | undefined;
    return handleTwoFAVerification({
      request,
      redirectTo: redirectToValue || "/",
    });
  }

  const submission = parseWithZod(formData, { schema: verifySchema });

  if (submission.status !== "success") {
    return data(submission.reply(), { status: 400 });
  }

  const { code } = submission.value;
  const userId = dbSession.userId;

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

  // Activate 2FA -- change type from 2fa-verify to 2fa, set far-future expiry
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
    select: { email: true, tenantId: true },
  });

  // Generate recovery codes
  const recoveryCodes = await generateRecoveryCodes(userId);

  await prisma.auditLog.create({
    data: {
      userId,
      tenantId: user?.tenantId,
      action: "TWO_FACTOR_ENABLE",
      entityType: "User",
      entityId: userId,
      description: `Two-factor authentication enabled for ${user?.email} (enforced setup)`,
      ipAddress: request.headers.get("x-forwarded-for") ?? undefined,
      userAgent: request.headers.get("user-agent") ?? undefined,
    },
  });

  return data({ recoveryCodes });
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

function RecoveryCodesDisplay({
  codes,
  onContinue,
}: {
  codes: string[];
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([codes.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Save Your Recovery Codes
        </CardTitle>
        <CardDescription>
          Store these codes in a safe place. Each code can only be used once. If you lose access to
          your authenticator app, you can use these codes to sign in.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
          {codes.map((code, i) => (
            <code key={i} className="font-mono text-sm">
              {code}
            </code>
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="mr-2 h-4 w-4" /> Copy all
              </>
            )}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
            Download
          </Button>
        </div>
        <Button className="w-full" onClick={onContinue}>
          I've saved my codes — Continue
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ForcedTwoFASetupPage({ actionData }: Route.ComponentProps) {
  const loaderData = useLoaderData<typeof loader>();

  const recoveryCodes =
    actionData && "recoveryCodes" in actionData ? actionData.recoveryCodes : null;

  const [form, fields] = useForm({
    lastResult: recoveryCodes ? undefined : (actionData as any),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: verifySchema });
    },
    shouldRevalidate: "onBlur",
  });

  if (recoveryCodes) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-lg">
          <RecoveryCodesDisplay
            codes={recoveryCodes as string[]}
            onContinue={() => {
              // Submit to finalize the session — uses a simple form POST
              const form = document.createElement("form");
              form.method = "POST";
              form.action = "/auth/2fa-setup";
              const input = document.createElement("input");
              input.name = "intent";
              input.value = "finalize";
              form.appendChild(input);
              document.body.appendChild(form);
              form.submit();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col gap-6">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Your organization requires two-factor authentication. Please complete the setup
                below to continue.
              </p>
            </div>
          </div>

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

                    <Button type="submit" className="w-full">
                      Verify &amp; Continue
                    </Button>
                  </div>
                </Form>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
