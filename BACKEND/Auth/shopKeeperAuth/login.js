import shopKeeper from "../../Schema/shopKeeper.js";
import jwt from "jsonwebtoken";
import { legacyJwtSecret, legacyJwtExpire } from "../../config/env.js";

const shopKeeperLogin = async (req, res) => {
  try {
    const { email, password, panel } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const existUser = await shopKeeper.findOne({ email }).select("+password");
    if (!existUser) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await existUser.comparePassword(password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      {
        sub: String(existUser._id),
        email: existUser.email,
        cartId: existUser.cartId,
        panel: panel || existUser.panel,
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

    return res.status(200).json({
      message: "Logged in",
      user: { email: existUser.email, panel: existUser.panel },
    });
  } catch (error) {
    console.error("shopKeeperLogin error:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default shopKeeperLogin;
