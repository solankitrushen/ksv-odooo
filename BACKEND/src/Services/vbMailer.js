import nodemailer from "nodemailer";
import { logger } from "../Utils/logger.js";

function buildTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE !== "false",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export async function sendVendorEmail({ to, subject, text, html, attachments }) {
  const transport = buildTransport();
  if (!transport) {
    logger.warn("SMTP not configured — email skipped", { to, subject });
    return { sent: false };
  }
  try {
    await transport.sendMail({
      from: `${process.env.SMTP_FROM_NAME || "VendorBridge"} <${process.env.SENDER_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || undefined,
      html: html || (text ? `<p>${text}</p>` : undefined),
      attachments: attachments || undefined,
    });
    return { sent: true };
  } catch (err) {
    logger.error("Vendor email failed", { error: err.message, to, subject });
    return { sent: false };
  }
}

export async function sendVendorInviteEmail({ to, tenantName, link }) {
  const transport = buildTransport();
  if (!transport) {
    logger.warn("SMTP not configured — invite email skipped", { to });
    return { sent: false };
  }
  try {
    await transport.sendMail({
      from: `${process.env.SMTP_FROM_NAME || "VendorBridge"} <${process.env.SENDER_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject: `You're invited to ${tenantName} on VendorBridge`,
      text: `Activate your vendor account: ${link}`,
      html: `<p>You have been invited to <b>${tenantName}</b> on VendorBridge.</p><p><a href="${link}">Activate your account</a></p>`,
    });
    return { sent: true };
  } catch (err) {
    logger.error("Invite email failed", { error: err.message, to });
    return { sent: false };
  }
}
