import registerBranchUser from "../../Schema/branchmanagerschema.js";
import jwt from "jsonwebtoken";
import { legacyJwtSecret, legacyJwtExpire } from "../../config/env.js";

const branchUser = async (req, res) => {
  try {
    const { email, password, confirmPass } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }
    if (password !== confirmPass) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await registerBranchUser.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const { confirmPass: _omit, ...safeBody } = req.body || {};
    const createBranchUser = await registerBranchUser.create(safeBody);

    const branchToken = jwt.sign(
      { sub: String(createBranchUser._id), email, purpose: "verify-email" },
      legacyJwtSecret(),
      { expiresIn: "30m" }
    );
    const verifyUrl = `${process.env.CLIENT_URL_4 || ""}/branch/verify/${branchToken}`;

    if (process.env.NODE_ENV !== "production") {
      console.log("[branchUser] verify url issued for", email);
    }

    return res.status(201).json({
      message: "Registered. Please verify your email.",
      verifyUrl: process.env.NODE_ENV === "production" ? undefined : verifyUrl,
    });
  } catch (error) {
    console.error("branchUser register error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default branchUser;
