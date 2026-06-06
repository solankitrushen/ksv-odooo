import jwt from "jsonwebtoken";
import registerUsers from "../Schema/register.js";
import registerBranchUser from "../Schema/branchmanagerschema.js";
const authMiddleware = async (req, res, next) => {
  const token = req.cookies.Authtoken;
  const branchauth = req.cookies.branchAuthtoken;

  if (token) {
    try {
      const { email } = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await registerUsers.findOne({ email }).select("email");
      next();
    } catch (error) {
      // console.log(error);
      res.status(401).json({ error: "Request not authenticated" });
    }
  } else if (branchauth) {
    try {
      const { email } = jwt.verify(branchauth, process.env.JWT_SECRET);
      req.user = await registerBranchUser.findOne({ email }).select("email");
      next();
    } catch (error) {
      // console.log(error);
      res.status(401).json({ error: "Request not authenticated" });
    }
  } else {
    res.status(401).json({ error: "token not found" });
  }
};
export default authMiddleware;
