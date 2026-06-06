import shopKeeper from "../../Schema/shopKeeper.js";
import { sendRegistrationPendingEmail } from "../../mailService/mail.js";
import jwt from "jsonwebtoken";
import { legacyJwtSecret, legacyJwtExpire } from "../../config/env.js";

const registerShopKeeper = async (req, res) => {
  try {
    const {
      username,
      fullName,
      dept,
      designation,
      mNumber,
      email,
      password,
      confirmPass,
      panel,
      empId,
    } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    if (password !== confirmPass) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await shopKeeper.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const newUser = await shopKeeper.create({
      shopKeeperId: empId,
      username,
      fullName,
      dept,
      designation,
      mNumber,
      email,
      password,
      panel,
    });

    try {
      await sendRegistrationPendingEmail(email);
    } catch (mailErr) {
      console.warn("Registration mail failed:", mailErr.message);
    }

    if (panel === "Branch Manager") {
      const token = jwt.sign(
        {
          sub: String(newUser._id),
          email,
          cartId: newUser.cartId,
          panel,
          role: "shopkeeper",
        },
        legacyJwtSecret(),
        { expiresIn: legacyJwtExpire() }
      );
      const isProd = process.env.NODE_ENV === "production";
      res.cookie("shopKeeperAuthToken", token, {
        httpOnly: true,
        sameSite: isProd ? "strict" : "lax",
        secure: isProd,
        maxAge: 12 * 60 * 60 * 1000,
      });
    }

    return res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("registerShopKeeper error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default registerShopKeeper;
