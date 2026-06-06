import jwt from "jsonwebtoken";
import registerUsers from "../Schema/register.js";
import registerBranchUser from "../Schema/branchmanagerschema.js";
import shopKeeper from "../Schema/shopKeeper.js";
import { legacyJwtSecret } from "../config/env.js";

const ROLE_MODEL = {
  employee: registerUsers,
  branchmanager: registerBranchUser,
  shopkeeper: shopKeeper,
};

/**
 * Resolve the first cookie / Authorization header that produces a valid
 * token. Each cookie/role is tried in turn; first match wins.
 */
function extractToken(req) {
  const candidates = [
    { cookie: "Authtoken", role: "employee" },
    { cookie: "branchAuthtoken", role: "branchmanager" },
    { cookie: "shopKeeperAuthToken", role: "shopkeeper" },
  ];

  for (const c of candidates) {
    const token = req.cookies?.[c.cookie];
    if (token) return { token, hintedRole: c.role };
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return { token: header.split(" ")[1], hintedRole: null };
  }
  return { token: null, hintedRole: null };
}

export function legacyAuth(allowedRoles = null) {
  return async (req, res, next) => {
    try {
      const { token, hintedRole } = extractToken(req);
      if (!token) {
        return res
          .status(401)
          .json({ success: false, error: "Authentication required" });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, legacyJwtSecret());
      } catch (err) {
        return res
          .status(401)
          .json({ success: false, error: "Invalid or expired token" });
      }

      if (decoded.purpose === "verify-email") {
        return res
          .status(401)
          .json({ success: false, error: "Wrong token type" });
      }

      const role = decoded.role || hintedRole;
      const Model = ROLE_MODEL[role];
      if (!Model) {
        return res
          .status(401)
          .json({ success: false, error: "Unknown role" });
      }

      const userId = decoded.sub || decoded._id;
      if (!userId) {
        return res
          .status(401)
          .json({ success: false, error: "Malformed token" });
      }

      const userDoc = await Model.findById(userId).select(
        "_id email cartId panel role isConfirmed verified"
      );
      if (!userDoc) {
        return res
          .status(401)
          .json({ success: false, error: "Account not found" });
      }

      req.legacyUser = {
        _id: userDoc._id,
        email: userDoc.email,
        cartId: userDoc.cartId,
        panel: userDoc.panel,
        role,
        isConfirmed: userDoc.isConfirmed,
        verified: userDoc.verified,
      };

      if (allowedRoles && !allowedRoles.includes(role)) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden role" });
      }

      next();
    } catch (err) {
      console.error("legacyAuth error:", err.message);
      return res
        .status(500)
        .json({ success: false, error: "Authentication error" });
    }
  };
}

export default legacyAuth;
