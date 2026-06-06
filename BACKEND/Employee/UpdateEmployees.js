import RegisterUsers from "../Schema/register.js";
import {
  sendApprovalNotificationEmail,
  sendDeclineNotificationEmail
} from "../mailService/mail.js";

const UpdateEmployees = async (req, res) => {
  try {
    const { empId, isConfirmed } = req.body;

    if (!empId || !isConfirmed) {
      return res.status(400).json({ message: "Invalid request" });
    }

    const user = await RegisterUsers.findOne({ empId });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update the user's isConfirmed based on the requested isConfirmed
    if (isConfirmed === "approved") {
      user.isConfirmed = "approved";
    } else if (isConfirmed === "declined") {
      user.isConfirmed = "declined";
    } else {
      return res.status(400).json({ message: "Invalid isConfirmed" });
    }

    await user.save();
    if (isConfirmed === "approved") {
      try {
        await sendApprovalNotificationEmail(user.email);
        return res.json({ message: "User approved successfully" });
      } catch (error) {
        console.error("Error sending approval email", error);
        return res.status(500).json({ message: "Email could not be sent" });
      }
    } else if (isConfirmed === "declined") {
      try {
        await sendDeclineNotificationEmail(user.email);
        return res.json({ message: "User declined successfully" });
      } catch (error) {
        console.error("Error sending decline email", error);
        return res.status(500).json({ message: "Email could not be sent" });
      }
    }
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export default UpdateEmployees;
