import registerBranchUser from "../../Schema/branchmanagerschema.js";
import jwt from "jsonwebtoken";
import { legacyJwtSecret, legacyJwtExpire } from "../../config/env.js";

const branchLogin = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const user = await registerBranchUser.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.verified === false) {
      return res.status(403).json({ message: "Please verify your email first" });
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isConfirmed === "declined") {
      return res.status(403).json({ message: "You are unauthorized by admin" });
    }

    const token = jwt.sign(
      {
        sub: String(user._id),
        email: user.email,
        cartId: user.cartId,
        role: "branchmanager",
      },
      legacyJwtSecret(),
      { expiresIn: legacyJwtExpire() }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("branchAuthtoken", token, {
      httpOnly: true,
      sameSite: isProd ? "strict" : "lax",
      secure: isProd,
      maxAge: 12 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      message: "Login successful",
      verified: user.verified,
    });
  } catch (error) {
    console.error("branchLogin error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default branchLogin;
