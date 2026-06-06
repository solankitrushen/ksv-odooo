import nodemailer from "nodemailer";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path"; // Import the path module
import RegisterUsers from "../Schema/register.js";
import ejs from "ejs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: "teamsquare678@gmail.com",
    pass: "jcoe zyip juca knnn",
  },
});

function sendEmail(to, subject, text, html) {
  const mailOptions = {
    from: "teamsquare678@gmail.com",
    to,
    subject,
    text,
    html,
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(error);
      } else {
        resolve(info.response);
      }
    });
  });
}

async function sendRegistrationPendingEmail(employeeEmail) {
  const subject = "Registration Confirmation";
  const text =
    "Thank you for registering. Your registration has been received and is pending approval.";
  const user = await RegisterUsers.findOne({ email: employeeEmail });

  const html = ejs.render(
    fs.readFileSync(
      path.join(__dirname, "views", "registrationPending.ejs"),
      "utf8"
    ),
    {
      data: { firstname: user?.fullName },
    }
  );
  try {
    const response = await sendEmail(employeeEmail, subject, text, html);
    console.log("Email sent: " + response);
  } catch (error) {
    console.error(error);
    throw new Error("Email could not be sent");
  }
}

async function sendApprovalNotificationEmail(employeeEmail) {
  const subject = "Registration Approval";
  const user = await RegisterUsers.findOne({ email: employeeEmail });

  if (!user) {
    console.error("User not found for email: " + employeeEmail);
    throw new Error("User not found");
  }

  const text = `The registration for ${user.fullName} has been approved.`;
  const loginLink = "https://instagram.com"; // Replace with the actual login link

  const html = ejs.render(
    fs.readFileSync(
      path.join(__dirname, "views", "registrationApproved.ejs"),
      "utf8"
    ),
    {
      data: {
        firstname: user.fullName,
        email: user.email,
        loginLink: loginLink,
      },
    }
  );

  try {
    const response = await sendEmail(employeeEmail, subject, text, html);
    console.log("Email sent: " + response);
  } catch (error) {
    console.error(error);
    throw new Error("Email could not be sent");
  }
}

async function sendDeclineNotificationEmail(employeeEmail) {
  const subject = "Registration Decline";
  const text = `The registration for ${employeeEmail} has been declined.`;
  const user = await RegisterUsers.findOne({ email: employeeEmail });

  const html = ejs.render(
    fs.readFileSync(
      path.join(__dirname, "views", "registrationDecline.ejs"),
      "utf8"
    ),
    {
      data: { firstname: user.fullName },
    }
  );
  try {
    const response = await sendEmail(employeeEmail, subject, text, html);
    console.log("Email sent: " + response);
  } catch (error) {
    console.error(error);
    throw new Error("Email could not be sent");
  }
}

export {
  sendRegistrationPendingEmail,
  sendApprovalNotificationEmail,
  sendDeclineNotificationEmail,
};
