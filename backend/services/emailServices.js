import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendApplyConfirmationEmail = async (email, name, userId, registrationId, paperTitle, allAuthors) => {
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
  from: `"NEC Conference" <${process.env.EMAIL_USER}>`,
  to: email,
  subject: "Conference Registration Confirmation",
  html: `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #2E86C1;">Conference Registration Received</h2>

      <h1 style="color: #fbff00ff; background-color: #ff0000ff; text-align: center;">
        Registration ID: ${registrationId}
      </h1>

      <p>Dear <strong>${name}</strong>,</p>
      <p>We have successfully received your paper submission. Your registration has been confirmed with the above Paper ID.</p>

      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
        <h3 style="color: #2E86C1; margin-top: 0;">Paper Details:</h3>
        <p><strong>Paper ID:</strong> ${registrationId}</p>
        <p><strong>Paper Title:</strong> ${paperTitle}</p>
        <p><strong>Created on:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Authors:</strong> ${allAuthors.map(author => author.name).join(', ')}</p>
        <p><strong>Submission Files:</strong> Document attached</p>
      </div>

      <p>Our team will review it and contact you soon.</p>
      <br>
      <p>Thanks,</p>
      <p><strong>ICoDSES Team</strong></p>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ccc;">
      <p style="font-size: 12px; color: #555; text-align: center;">
        <em>Note: This is a system-generated email. Please do not reply to it.</em>
      </p>
    </div>
  `
};

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Failed to send email to ${email}:`, error.message);
    throw error;
  }
};

export const sendReviewerCredentialsEmail = async (email, name, password) => {
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

  const loginUrl = process.env.FRONTEND_URL || 'https://nec.edu.in/ICoDSES/auth';

  const isDefaultPassword = password === "12345678";
  const securityMessage = isDefaultPassword ? "Your password is set to the default '12345678'. For your security, please change your password immediately after your first login. You can update your password in your profile settings." : "For your security, please change your password after your first login. You can update your password in your profile settings.";

  const mailOptions = {
    from: `"NEC Conference Admin" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Reviewer Account Credentials - NEC Conference",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">Reviewer Account Created</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">Welcome, ${name}!</h2>

          <p>Your reviewer account has been created successfully. Here are your login credentials:</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0 0 0;"><strong>Password:</strong> ${password}</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">⚠️ Important Security Notice</h3>
            <p style="margin-bottom: 0; color: #856404;">
              ${securityMessage}
            </p>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Go to the conference website</li>
            <li>Click on "Login" and use the credentials above</li>
            <li>After logging in, go to your profile to change your password</li>
            <li>Start reviewing assigned papers</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #2E86C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Account
            </a>
          </div>

          <p>If you have any questions, please contact the conference administrators.</p>

          <p>Best regards,<br><strong>NEC Conference Team</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reviewer credentials email sent successfully to ${email}`);
  } catch (error) {
    console.error(`Failed to send reviewer credentials email to ${email}:`, error.message);
    throw error;
  }
};

export const sendReviewerAssignmentEmail = async (reviewerEmail, reviewerName, paperTitle, paperId) => {
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

  // Calculate deadline: current date + 7 days
  const assignmentDate = new Date();
  const deadline = new Date(assignmentDate);
  deadline.setDate(deadline.getDate() + 7);

  const mailOptions = {
    from: `"NEC Conference Admin" <${process.env.EMAIL_USER}>`,
    to: reviewerEmail,
    subject: "Paper Review Assignment - NEC Conference",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">Paper Review Assignment</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">Dear ${reviewerName},</h2>

          <p>You have been assigned as a reviewer for the following paper:</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Paper ID:</strong> ${paperId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Paper Title:</strong> ${paperTitle}</p>
            <p style="margin: 5px 0 0 0;"><strong>Assignment Date:</strong> ${assignmentDate.toLocaleDateString()}</p>
            <p style="margin: 5px 0 0 0;"><strong>Review Deadline:</strong> ${deadline.toLocaleDateString()}</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">⏰ Important Deadline</h3>
            <p style="margin-bottom: 0; color: #856404;">
              You should complete reviewing the assigned paper within ${deadline.toLocaleDateString()}.
            </p>
          </div>

          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">📋 Review Guidelines</h3>
            <ul style="margin-bottom: 0; color: #0c5460;">
              <li>Please review the paper thoroughly and provide constructive feedback</li>
              <li>Consider the originality, technical quality, and relevance to the conference</li>
              <li>Submit your review within the specified deadline</li>
              <li>Use the conference review portal to submit your evaluation</li>
            </ul>
          </div>

          <p><strong>Next Steps:</strong></p>
          <ol>
            <li>Log in to your reviewer account on the conference website</li>
            <li>Navigate to "Assigned Papers" section</li>
            <li>Download and review the assigned paper</li>
            <li>Submit your review using the online review form</li>
          </ol>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://nec.edu.in/ICoDSES/auth" style="background-color: #2E86C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Access Reviewer Portal
            </a>
          </div>

          <p>If you have any questions about the paper or the review process, please contact the conference administrators.</p>

          <p>Thank you for your valuable contribution to the NEC Conference!</p>

          <p>Best regards,<br><strong>NEC Conference Committee</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Reviewer assignment email sent successfully to ${reviewerEmail}`);
  } catch (error) {
    console.error(`Failed to send reviewer assignment email to ${reviewerEmail}:`, error.message);
    throw error;
  }
};

export const sendPaperStatusUpdateEmail = async (authorEmail, authorName, paperTitle, paperId, status, comments, reviewerName) => {
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

  const statusText = status.replace('_', ' ').toUpperCase();
  const updateDate = new Date().toLocaleDateString();

  const mailOptions = {
    from: `"NEC Conference Admin" <${process.env.EMAIL_USER}>`,
    to: authorEmail,
    subject: `Paper Status Update - NEC Conference (Paper ID: ${paperId})`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">Paper Status Update</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">Dear ${authorName},</h2>

          <p>We are writing to inform you about an update to your paper submission:</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Paper ID:</strong> ${paperId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Paper Title:</strong> ${paperTitle}</p>
            <p style="margin: 5px 0 0 0;"><strong>Update Date:</strong> ${updateDate}</p>
            <p style="margin: 5px 0 0 0;"><strong>Reviewed By:</strong> ${reviewerName}</p>
          </div>

          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">📋 Status Update</h3>
            <p style="margin-bottom: 0; color: #0c5460;"><strong>New Status:</strong> ${statusText}</p>
          </div>

          <p><strong>What happens next?</strong></p>
          <ul>
            <li>If your paper is accepted, you will receive further instructions for publication</li>
            <li>If revisions are requested, you will be contacted with specific guidelines</li>
            <li>You can check your paper status anytime by logging into your account</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background-color: #2E86C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Check Paper Status
            </a>
          </div>

          <p>If you have any questions about this update or need further clarification, please contact the conference administrators.</p>

          <p>Thank you for your submission to the NEC Conference!</p>

          <p>Best regards,<br><strong>NEC Conference Committee</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Paper status update email sent successfully to ${authorEmail}`);
  } catch (error) {
    console.error(`Failed to send paper status update email to ${authorEmail}:`, error.message);
    throw error;
  }
};

export const sendFinalSubmissionResetEmail = async (authorEmail, authorName, paperTitle, paperId) => {
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

  const resetDate = new Date().toLocaleDateString();

  const mailOptions = {
    from: `"NEC Conference Admin" <${process.env.EMAIL_USER}>`,
    to: authorEmail,
    subject: `Final Submission Reset - NEC Conference (Paper ID: ${paperId})`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">Final Submission Reset</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">Dear ${authorName},</h2>

          <p>We are writing to inform you about a change to your paper submission:</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Paper ID:</strong> ${paperId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Paper Title:</strong> ${paperTitle}</p>
            <p style="margin: 5px 0 0 0;"><strong>Reset Date:</strong> ${resetDate}</p>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">📋 Important Notice</h3>
            <p style="margin-bottom: 0; color: #856404;">
              Your final submitted paper has been rejected, so please resubmit.
            </p>
          </div>

          <p><strong>What happens next?</strong></p>
          <ul>
            <li>You can now resubmit your final paper through your account</li>
            <li>Make sure to address any feedback provided by reviewers</li>
            <li>Submit your revised paper before the deadline</li>
            <li>You can check your paper status anytime by logging into your account</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background-color: #2E86C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Resubmit Paper
            </a>
          </div>

          <p>If you have any questions about this reset or need further clarification, please contact the conference administrators.</p>

          <p>Thank you for your continued participation in the NEC Conference!</p>

          <p>Best regards,<br><strong>NEC Conference Committee</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Final submission reset email sent successfully to ${authorEmail}`);
  } catch (error) {
    console.error(`Failed to send final submission reset email to ${authorEmail}:`, error.message);
    throw error;
  }
};

export const sendAdminPaperNotificationEmail = async (paperId, paperTitle, authors, submissionType) => {
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

  const adminEmail = 'icodses2026@nec.edu.in';
  const submissionDate = new Date().toLocaleDateString();
  const authorsList = authors.map(author => author.name).join(', ');

  const mailOptions = {
    from: `"NEC Conference System" <${process.env.EMAIL_USER}>`,
    to: adminEmail,
    subject: `New Paper ${submissionType} Received - NEC Conference (Paper ID: ${paperId})`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #2E86C1; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0;">
          <h1 style="margin: 0;">NEC Conference</h1>
          <p style="margin: 5px 0 0 0;">New Paper ${submissionType} Notification</p>
        </div>

        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 0 0 5px 5px;">
          <h2 style="color: #2E86C1; margin-top: 0;">New Paper Submission Received</h2>

          <p>A new paper has been submitted to the conference system. Please review the details below:</p>

          <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2E86C1;">
            <p style="margin: 0;"><strong>Paper ID:</strong> ${paperId}</p>
            <p style="margin: 5px 0 0 0;"><strong>Paper Title:</strong> ${paperTitle}</p>
            <p style="margin: 5px 0 0 0;"><strong>Authors:</strong> ${authorsList}</p>
            <p style="margin: 5px 0 0 0;"><strong>Submission Type:</strong> ${submissionType}</p>
            <p style="margin: 5px 0 0 0;"><strong>Submission Date:</strong> ${submissionDate}</p>
          </div>

          <div style="background-color: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">📋 Next Steps</h3>
            <ul style="margin-bottom: 0; color: #0c5460;">
              <li>Log in to the admin panel to review the submission</li>
              <li>Assign reviewers if not already assigned</li>
              <li>Monitor the review process</li>
              <li>Send status updates to authors as needed</li>
            </ul>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="#" style="background-color: #2E86C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Access Admin Panel
            </a>
          </div>

          <p>This is an automated notification. Please do not reply to this email.</p>

          <p>Best regards,<br><strong>NEC Conference System</strong></p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Admin notification email sent successfully to ${adminEmail} for paper ${paperId}`);
  } catch (error) {
    console.error(`Failed to send admin notification email to ${adminEmail}:`, error.message);
    throw error;
  }
};
