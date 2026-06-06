import User from "../Schema/User.js";
import Admin from "../Schema/Admin.js";
import Store from "../Schema/Store.js";
import VbUser from "../Schema/VbUser.js";
import VbMembership from "../Schema/VbMembership.js";
import { verifyToken, readAuthToken, readSessionId } from "../Auth/jwtUtils.js";
import { sendError } from "../Utils/errorResponse.js";
import { logger } from "../Utils/logger.js";
import { isSessionActive } from "../Utils/sessionManager.js";
import { ROLES } from "../../config/constants.js";

export function authMiddleware(req, res, next) {
  (async () => {
    try {
      const token = readAuthToken(req);

      if (!token) {
        return sendError(res, 401, "Unauthorized", "No token provided");
      }

      const decoded = verifyToken(token);
      req.user = decoded;
      req.userId = decoded.userId;
      req.role = decoded.role;

      if (decoded.realm === "vb") {
        const vbUser = await VbUser.findById(decoded.userId);
        if (!vbUser || !vbUser.isActive) {
          return sendError(res, 401, "Unauthorized", "Account inactive");
        }
        const sessionId = decoded.sessionId || readSessionId(req);
        if (!isSessionActive(vbUser, sessionId)) {
          return sendError(res, 401, "Unauthorized", "Session revoked or invalid");
        }
        const membership = await VbMembership.findOne({
          userId: decoded.userId,
          tenantId: decoded.tenantId,
          status: "active",
        });
        if (!membership) {
          return sendError(res, 401, "Unauthorized", "No active membership for tenant");
        }
        const s = vbUser.sessions?.find((x) => x.tokenId === sessionId);
        if (s) {
          s.lastUsedAt = new Date();
          await vbUser.save();
        }
        req.roles = membership.roles;
        req.tenantId = String(membership.tenantId);
        req.vbUser = vbUser;
        req.membership = membership;
        logger.debug("VB JWT verified", {
          roles: req.roles,
          tenantId: req.tenantId,
          userId: decoded.userId,
        });
        return next();
      }

      if (decoded.role === ROLES.USER) {
        const user = await User.findById(decoded.userId);
        if (!user || !user.isActive) {
          return sendError(res, 401, "Unauthorized", "Account inactive");
        }

        const sessionId = decoded.sessionId || readSessionId(req);
        if (!isSessionActive(user, sessionId)) {
          return sendError(res, 401, "Unauthorized", "Session revoked or invalid");
        }

        if (sessionId) {
          const s = user.sessions?.find((x) => x.tokenId === sessionId);
          if (s) s.lastUsedAt = new Date();
          await user.save();
        }
      } else if (decoded.role === ROLES.ADMIN) {
        const admin = await Admin.findById(decoded.userId);
        if (!admin || !admin.isActive) {
          return sendError(res, 401, "Unauthorized", "Admin account invalid");
        }
        const sid = decoded.sessionId || readSessionId(req);
        if (sid && !isSessionActive(admin, sid)) {
          return sendError(res, 401, "Unauthorized", "Session revoked");
        }
      } else if (decoded.role === ROLES.STORE) {
        const store = await Store.findById(decoded.userId);
        if (!store || !store.isActive) {
          return sendError(res, 401, "Unauthorized", "Store account invalid");
        }
        const tokenCv = Number.isFinite(decoded.cv) ? decoded.cv : 0;
        const dbCv = Number.isFinite(store.credentialsVersion)
          ? store.credentialsVersion
          : 0;
        if (tokenCv !== dbCv) {
          return sendError(
            res,
            401,
            "Unauthorized",
            "Credentials changed; please log in again"
          );
        }
        const sid = decoded.sessionId || readSessionId(req);
        if (sid && !isSessionActive(store, sid)) {
          return sendError(res, 401, "Unauthorized", "Session revoked");
        }
      }

      logger.debug("JWT verified", {
        role: decoded.role,
        userId: decoded.userId,
      });
      next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return sendError(res, 401, "Token expired", "Please login again");
      }
      if (error.name === "JsonWebTokenError") {
        logger.warn("Invalid JWT", { message: error.message });
        return sendError(res, 401, "Invalid token", "Authentication failed");
      }
      return sendError(res, 500, "Authentication error", "Internal error");
    }
  })();
}

export default authMiddleware;
