import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendFinalSubmissionConfirmationEmail = async (email, name, paperTitle, paperId) => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS in .env file');
    throw new Error('Email service not configured');
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    service: "Gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  const mailOptions = {
    from: `"NEC Conference Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Camera Ready Submission Confirmation - NEC Conference",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">Camera Ready Submission Received</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">Dear ${name},</h2>

          <p>We have successfully received your camera ready submission.</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Paper ID:</strong> ${paperId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Paper Title:</strong> ${paperTitle}</p>
            <p style="margin: 5px 0 0 0;"><strong>Submission Date:</strong> ${new Date().toLocaleDateString()}</p>
          </div>

          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">📋 Next Steps</h3>
            <p style="margin-bottom: 0; color: #0c5460;">Our team will contact you soon regarding the publication process.</p>
          </div>

          <p>Thank you for your submission to the NEC Conference!</p>

          <p>Best regards,<br><strong>NEC Conference Committee</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Final submission confirmation email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Failed to send final submission confirmation email to ${email}:`, error.message);
    throw error;
  }
};
