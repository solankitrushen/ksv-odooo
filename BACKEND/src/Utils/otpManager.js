import crypto from "crypto";
import nodemailer from "nodemailer";
import { logger } from "./logger.js";

export function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

export async function sendOTPEmail(to, otp, name = "User", purpose = "verification") {
  const subject =
    purpose === "login"
      ? "InstaCafe login code"
      : purpose === "password-reset"
      ? "InstaCafe password reset code"
      : "Verify your InstaCafe email";
  const text = `Hi ${name},\n\nYour code is: ${otp}\n\nExpires in 10 minutes.\n`;

  logger.info("OTP email attempt", { to, purpose });

  if (process.env.NODE_ENV === "test") {
    logger.info("OTP email skipped (test mode)", { to, otp });
    return { sent: true, test: true };
  }

  const transport = getTransporter();

  try {
    const info = await transport.sendMail({
      from: `"${process.env.SMTP_FROM_NAME || "InstaCafe"}" <${process.env.SENDER_EMAIL || process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });
    logger.info("OTP email sent", { to, messageId: info.messageId, response: info.response });
    return { sent: true };
  } catch (err) {
    logger.error("OTP email FAILED", { to, error: err.message, code: err.code, command: err.command });
    throw err;
  }
}

export function otpExpiryMs() {
  return parseInt(process.env.OTP_EXPIRY_MS || "600000", 10);
}

export function lockoutMs() {
  return parseInt(
    process.env.ACCOUNT_LOCKOUT_DURATION_MS || "900000",
    10
  );
}
