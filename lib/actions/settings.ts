"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/auth/session";
import { randomToken } from "@/lib/crypto/secrets";
import { db, fulfillmentRules, storeMemberships, users } from "@/lib/db";
import { env } from "@/lib/env";
import { guard, type ActionResult } from "./result";

// ---------------------------------------------------------------------------
// Fulfillment rules
// ---------------------------------------------------------------------------

export async function updateFulfillmentRulesAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { tdb } = await requireOwner();

    const values = {
      enabled: formData.get("enabled") === "on",
      requireDeliveryConfirmation:
        formData.get("requireDeliveryConfirmation") === "on",
      notifyCustomerOnFulfillment:
        formData.get("notifyCustomerOnFulfillment") === "on",
      updatedAt: new Date(),
    };

    const existing = await tdb.findFirst(fulfillmentRules);
    if (existing) {
      await tdb.updateById(fulfillmentRules, existing.id, values);
    } else {
      await tdb.insertOne(fulfillmentRules, values);
    }

    revalidatePath("/admin/settings/fulfillment");

    return {
      ok: true,
      message: values.requireDeliveryConfirmation
        ? "Saved. Orders will only be fulfilled after the agency confirms delivery."
        : "Saved. Warning: fulfillment no longer requires a confirmed delivery.",
    };
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Invites someone to this store. The invite is a single-use token with a
 * one-week life; the invitee sets their own password when accepting, so no
 * password is ever chosen or transmitted on their behalf.
 */
export async function inviteUserAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { store, user: actor } = await requireOwner();

    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const role = String(formData.get("role") ?? "agency");
    const name = String(formData.get("name") ?? "").trim();

    if (!email || !email.includes("@")) {
      return { fieldErrors: { email: "Enter a valid email address." } };
    }
    if (role !== "agency" && role !== "owner") {
      return { fieldErrors: { role: "Choose a role." } };
    }

    // Reuse the account if this person already has one on the platform.
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const invitee =
      existingUser ??
      (
        await db
          .insert(users)
          .values({ email, name: name || null, passwordHash: null })
          .returning()
      )[0];

    const [existingMembership] = await db
      .select()
      .from(storeMemberships)
      .where(
        and(
          eq(storeMemberships.storeId, store.id),
          eq(storeMemberships.userId, invitee.id),
        ),
      )
      .limit(1);

    if (existingMembership?.status === "active") {
      return { error: `${email} already has access to this store.` };
    }

    const token = randomToken(24);
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    await db
      .insert(storeMemberships)
      .values({
        storeId: store.id,
        userId: invitee.id,
        role,
        status: "invited",
        inviteToken: token,
        inviteExpiresAt: expiresAt,
        invitedByUserId: actor.id,
      })
      .onConflictDoUpdate({
        target: [storeMemberships.storeId, storeMemberships.userId],
        set: {
          role,
          status: "invited",
          inviteToken: token,
          inviteExpiresAt: expiresAt,
          invitedByUserId: actor.id,
          updatedAt: new Date(),
        },
      });

    const inviteUrl = `${env.appUrl}/invite?token=${token}`;
    const delivered = await sendInviteEmail({
      to: email,
      storeName: store.name ?? store.shopDomain,
      inviteUrl,
      hasPassword: Boolean(invitee.passwordHash),
    });

    revalidatePath("/admin/settings/users");

    return {
      ok: true,
      message: delivered
        ? `Invitation sent to ${email}.`
        : `Invitation created. Email could not be sent, so share this link directly: ${inviteUrl}`,
    };
  });
}

/** Removes someone's access. The account itself is left alone. */
export async function revokeMembershipAction(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async (): Promise<ActionResult> => {
    const { store, user: actor } = await requireOwner();
    const membershipId = String(formData.get("membershipId") ?? "");

    const [membership] = await db
      .select()
      .from(storeMemberships)
      .where(
        and(
          eq(storeMemberships.id, membershipId),
          eq(storeMemberships.storeId, store.id),
        ),
      )
      .limit(1);

    if (!membership) return { error: "That user is not a member of this store." };
    if (membership.userId === actor.id) {
      return { error: "You cannot remove your own access." };
    }

    // A store must always keep at least one owner who can administer it.
    if (membership.role === "owner") {
      const owners = await db
        .select({ id: storeMemberships.id })
        .from(storeMemberships)
        .where(
          and(
            eq(storeMemberships.storeId, store.id),
            eq(storeMemberships.role, "owner"),
            eq(storeMemberships.status, "active"),
          ),
        );
      if (owners.length <= 1) {
        return { error: "A store must keep at least one owner." };
      }
    }

    await db
      .update(storeMemberships)
      .set({
        status: "revoked",
        inviteToken: null,
        inviteExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(storeMemberships.id, membershipId));

    revalidatePath("/admin/settings/users");
    return { ok: true, message: "Access revoked." };
  });
}

/** Sends the invitation email, returning false when email is unavailable. */
async function sendInviteEmail({
  to,
  storeName,
  inviteUrl,
  hasPassword,
}: {
  to: string;
  storeName: string;
  inviteUrl: string;
  hasPassword: boolean;
}): Promise<boolean> {
  if (!env.resend.configured) return false;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(env.resend.apiKey);

    const action = hasPassword
      ? "Accept the invitation with your existing Tracky password."
      : "Accept the invitation and choose a password.";

    const { error } = await resend.emails.send({
      from: `${env.resend.fromName} <${env.resend.fromEmail}>`,
      to: [to],
      subject: `You have been invited to manage deliveries for ${storeName}`,
      html: `
        <p>Hello,</p>
        <p>You have been invited to help manage deliveries for <strong>${escapeHtml(storeName)}</strong> in Tracky.</p>
        <p>${action}</p>
        <p><a href="${inviteUrl}">Accept the invitation</a></p>
        <p>This link expires in 7 days.</p>
      `,
      text: `You have been invited to help manage deliveries for ${storeName} in Tracky.\n\n${action}\n\n${inviteUrl}\n\nThis link expires in 7 days.`,
    });

    return !error;
  } catch (error) {
    console.error("[invite] failed to send invitation email", error);
    return false;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
