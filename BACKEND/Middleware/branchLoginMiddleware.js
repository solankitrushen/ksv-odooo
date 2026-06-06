import jwt from "jsonwebtoken";
import registerUsers from "../Schema/register.js";

const branchAuthMiddleware = async (req, res, next) => {
  const branchauth = req.cookies.branchAuthtoken;

  if (!branchauth) {
    return res.status(401).json({ error: "Branch User Authentication required" });
  }

  try {
    const { branchEmail } = jwt.verify(branchauth, process.env.JWT_SECRET);
    req.branchuser = await registerUsers.findOne({ branchEmail }).select("email");


  } catch (error) {
    console.log(error);
    res.status(401).json({ error: "Branch User Authentication failed" });
  }
};

export default branchAuthMiddleware;
