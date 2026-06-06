import shopKeeper from "../../Schema/shopKeeper.js";
import jwt from "jsonwebtoken";
import { legacyJwtSecret } from "../../config/env.js";

const authenticateShopKeeperAccount = async (req, res) => {
  try {
    const shopKeeperToken = req.params.shopKeeperToken;
    let decoded;
    try {
      decoded = jwt.verify(shopKeeperToken, legacyJwtSecret());
    } catch (err) {
      return res.status(400).json({ message: "Invalid or expired link" });
    }
    if (decoded.purpose !== "verify-email") {
      return res.status(400).json({ message: "Invalid token purpose" });
    }
    const user = await shopKeeper.findById(decoded.sub);
    if (!user) {
      return res.status(404).json({ message: "Link does not exist" });
    }
    if (!user.verified) {
      user.verified = true;
      await user.save();
    }
    return res.status(200).json({ message: "Verification successful" });
  } catch (err) {
    console.error("authenticateShopKeeper error:", err.message);
    return res.status(500).json({ message: "unverified" });
  }
};

export default authenticateShopKeeperAccount;
