import crypto from "node:crypto";
import { prisma } from "~/utils/db/db.server";
import { sendEmail } from "~/utils/email/email.server";
import { invitationEmail } from "~/utils/email/email-templates.server";
import { logger } from "~/utils/monitoring/logger.server";

const INVITE_EXPIRY_DAYS = 7;

interface CreateInvitationInput {
  email: string;
  tenantId: string;
  roleIds: string[];
  invitedById: string;
}

export async function createInvitation(input: CreateInvitationInput) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email: input.email,
      tenantId: input.tenantId,
      roleIds: input.roleIds,
      token,
      invitedById: input.invitedById,
      expiresAt,
    },
    include: {
      tenant: { select: { name: true } },
      invitedBy: { select: { name: true, email: true } },
    },
  });

  const inviterName = invitation.invitedBy.name || invitation.invitedBy.email;
  const template = invitationEmail(token, invitation.tenant.name, inviterName);
  await sendEmail({ to: input.email, ...template }).catch((err) => {
    logger.error({ email: input.email, err }, "Failed to send invitation email");
  });

  return invitation;
}

export async function getInvitationByToken(token: string) {
  return prisma.invitation.findUnique({
    where: { token },
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function acceptInvitation(token: string, userId: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation || invitation.status !== "PENDING") {
    throw new Error("Invalid invitation");
  }

  if (invitation.expiresAt < new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Invitation has expired");
  }

  // Assign roles to user
  for (const roleId of invitation.roleIds) {
    await prisma.userRole.create({
      data: { userId, roleId },
    }).catch(() => {
      // Skip if already assigned
    });
  }

  // Mark invitation as accepted
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { status: "ACCEPTED" },
  });

  return invitation;
}

export async function revokeInvitation(id: string, tenantId: string) {
  return prisma.invitation.update({
    where: { id, tenantId },
    data: { status: "REVOKED" },
  });
}

export async function getInvitations(tenantId: string) {
  return prisma.invitation.findMany({
    where: { tenantId },
    include: {
      invitedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
