import jwt from "jsonwebtoken";
import registerUsers from "../Schema/register.js";

const tokenAuthMiddleware = async (req, res) => {
  const token = req.cookies.Authtoken;

  if (!token) {
    return res.status(401).json({ error: "Token Authentication required" });
  }

  try {
    const { email } = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await registerUsers.findOne({ email }).select("email");
    if (!req.user) {
      return res.status(401).json({ error: "User not found" });
    }
    return res.status(200).json({ message: "authenticated" });
  } catch (error) {
    console.log(error);
    return res.status(401).json({ error: "Token Authentication failed" });
  }
};

export default tokenAuthMiddleware;
