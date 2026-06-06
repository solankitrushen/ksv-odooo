import registerUsers from "../../Schema/register.js";
import jwt from "jsonwebtoken";
import { sendRegistrationPendingEmail } from "../../mailService/mail.js";
import { legacyJwtSecret } from "../../config/env.js";

const employeeUser = async (req, res) => {
  try {
    const { email, password, confirmPass } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    if (password !== confirmPass) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await registerUsers.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const { confirmPass: _omit, ...safeBody } = req.body || {};
    const createEmployeeUser = await registerUsers.create(safeBody);

    const employeeToken = jwt.sign(
      {
        sub: String(createEmployeeUser._id),
        email,
        cartId: createEmployeeUser.cartId,
        purpose: "verify-email",
      },
      legacyJwtSecret(),
      { expiresIn: "30m" }
    );
    const verifyUrl = `${process.env.CLIENT_URL_4 || ""}/employee/verify/${employeeToken}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[employeeUser] verify url issued for", email);
    }

    try {
      await sendRegistrationPendingEmail(email);
    } catch (mailErr) {
      console.warn("Registration mail failed:", mailErr.message);
    }

    return res.status(201).json({
      message: "Registered. Please verify your email.",
      verifyUrl: process.env.NODE_ENV === "production" ? undefined : verifyUrl,
    });
  } catch (error) {
    console.error("employeeUser register error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default employeeUser;
