import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Dynamic frontend URL helper
const getFrontendUrl = () => {
  // Try to get from environment variable first
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // Default to localhost for development
  return 'http://localhost:3000';
};

// Create email transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send verification code email
const sendVerificationCode = async (email, code, firstName = '') => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'NCIP Portal - Login Verification Code',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #3B82F6, #4F46E5); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f8fafc; }
          .code-box { background: white; border: 2px solid #3B82F6; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #3B82F6; letter-spacing: 8px; font-family: monospace; }
          .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏛️ NCIP Portal</h1>
            <p>National Commission on Indigenous Peoples</p>
          </div>
          
          <div class="content">
            <h2>Login Verification Code</h2>
            <p>Hello ${firstName ? firstName : 'User'},</p>
            <p>You requested to log in to your NCIP Portal account. Please use the verification code below:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code expires in <strong>10 minutes</strong></li>
              <li>Do not share this code with anyone</li>
              <li>If you didn't request this, please ignore this email</li>
            </ul>
            
            <p>Thank you for using NCIP Digital Services!</p>
          </div>
          
          <div class="footer">
            <p>© 2024 National Commission on Indigenous Peoples - Alabel, Sarangani Province</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Verification email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Test email connection
const testEmailConnection = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error.message);
    return false;
  }
};

// Send registration verification code email
const sendRegistrationVerificationCode = async (email, code, firstName = '') => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'NCIP Portal - Complete Your Registration',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; }
          .header { background: linear-gradient(135deg, #10B981, #059669); color: white; padding: 20px; text-align: center; }
          .content { padding: 30px; background: #f0fdf4; }
          .code-box { background: white; border: 2px solid #10B981; border-radius: 10px; padding: 20px; text-align: center; margin: 20px 0; }
          .code { font-size: 32px; font-weight: bold; color: #10B981; letter-spacing: 8px; font-family: monospace; }
          .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏛️ Welcome to NCIP Portal</h1>
            <p>Complete Your Account Registration</p>
          </div>
          
          <div class="content">
            <h2>Email Verification Required</h2>
            <p>Hello ${firstName ? firstName : 'Future Member'},</p>
            <p>Welcome to the NCIP Digital Portal! To complete your account registration, please verify your email address using the code below:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
              <li>Enter this code in the registration form</li>
              <li>Complete your profile setup</li>
              <li>Start applying for your Certificate of Confirmation</li>
            </ul>
            
            <p><strong>Important:</strong></p>
            <ul>
              <li>This code expires in <strong>15 minutes</strong></li>
              <li>Keep this code secure and don't share it</li>
              <li>If you didn't create this account, please ignore this email</li>
            </ul>
            
            <p>Thank you for joining the NCIP Digital Services community!</p>
          </div>
          
          <div class="footer">
            <p>© 2024 National Commission on Indigenous Peoples - Alabel, Sarangani Province</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('Registration verification email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending registration verification email:', error);
    return { success: false, error: error.message };
  }
};

// Send approval email
const sendApprovalEmail = async (email, fullName) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"NCIP Registration System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: '🎉 NCIP Account Approved - Welcome!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Account Approved!</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Welcome to NCIP Digital Services!</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Dear <strong>${fullName}</strong>,</p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Congratulations! Your NCIP account registration has been <strong style="color: #059669;">approved</strong> by our administrators.
            </p>
            
            <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #065f46; margin: 0; font-weight: 500;">✅ Your account is now active and ready to use!</p>
            </div>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              You can now log in to access NCIP digital services including:
            </p>
            
            <ul style="color: #4b5563; font-size: 16px; line-height: 1.8; padding-left: 20px;">
              <li>Certificate of Confirmation (COC) applications</li>
              <li>Document submissions and tracking</li>
              <li>Service requests and updates</li>
              <li>Profile management</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || getFrontendUrl()}/login" 
                 style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Login to Your Account</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions or need assistance, please contact our support team.<br>
              <strong>NCIP Digital Services Team</strong>
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Approval email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending approval email:', error);
    return { success: false, error: error.message };
  }
};

// Send rejection email with admin comment
const sendRejectionEmail = async (email, fullName, adminComment) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"NCIP Registration System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'NCIP Registration Update - Action Required',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">📋 Registration Update</h1>
          </div>
          
          <div style="background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Registration Review Complete</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">Dear <strong>${fullName}</strong>,</p>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Thank you for your interest in NCIP digital services. After reviewing your registration, we need you to address some items before we can approve your account.
            </p>
            
            <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 16px;">📝 Administrator Notes:</h3>
              <p style="color: #7f1d1d; margin: 0; font-style: italic; line-height: 1.6;">${adminComment}</p>
            </div>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              <strong>What to do next:</strong>
            </p>
            
            <ol style="color: #4b5563; font-size: 16px; line-height: 1.8; padding-left: 20px;">
              <li>Review the administrator notes above</li>
              <li>Prepare the correct documents or information</li>
              <li>Submit a new registration with the updated details</li>
            </ol>
            
            <div style="background: #f0f9ff; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="color: #0c4a6e; margin: 0; font-weight: 500;">💡 You can use the same email address to register again once you've addressed the noted items.</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL || getFrontendUrl()}/register" 
                 style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Register Again</a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have questions about the registration requirements, please contact our support team.<br>
              <strong>NCIP Digital Services Team</strong>
            </p>
          </div>
        </div>
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Rejection email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('Error sending rejection email:', error);
    return { success: false, error: error.message };
  }
};

export {
  sendVerificationCode,
  sendRegistrationVerificationCode,
  sendApprovalEmail,
  sendRejectionEmail,
  testEmailConnection
};
