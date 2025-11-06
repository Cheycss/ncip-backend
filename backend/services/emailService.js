import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

dotenv.config();

// Configure SendGrid if API key is available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Dynamic frontend URL helper
const getFrontendUrl = () => {
  // Try to get from environment variable first
  if (process.env.FRONTEND_URL) {
    return process.env.FRONTEND_URL;
  }
  
  // Default to localhost for development
  return 'http://localhost:3000';
};

// Create email transporter with proper Gmail configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // Use STARTTLS
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates
    },
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 10000
  });
};

// Send verification code email
const sendVerificationCode = async (email, code, firstName = '') => {
  // Use SendGrid if available, otherwise fall back to SMTP
  if (process.env.SENDGRID_API_KEY) {
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      subject: 'NCIP, Alabel Sarangani - Login Verification Code',
      html: getVerificationEmailHTML(code, firstName)
    };
    
    try {
      await sgMail.send(msg);
      console.log('✅ Verification email sent via SendGrid');
      return { success: true };
    } catch (error) {
      console.error('❌ SendGrid error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Fallback to SMTP
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'NCIP Portal - Login Verification Code',
    html: getVerificationEmailHTML(code, firstName)
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent via SMTP:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ SMTP error:', error);
    return { success: false, error: error.message };
  }
};

// Email HTML template helper
const getVerificationEmailHTML = (code, firstName = '') => {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background-color: #f6f8fa;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 6px;
          }
          .logo {
            text-align: center;
            padding: 40px 20px 20px;
          }
          .logo-circle {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background: #10b981;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
            color: white;
          }
          .content {
            padding: 20px 40px 40px;
            color: #24292f;
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 20px;
            text-align: center;
            color: #24292f;
          }
          .message {
            font-size: 16px;
            line-height: 1.5;
            color: #57606a;
            margin-bottom: 24px;
          }
          .code-box {
            background-color: #f6f8fa;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .code {
            font-size: 32px;
            font-weight: 600;
            letter-spacing: 8px;
            color: #24292f;
            font-family: 'Courier New', monospace;
          }
          .info-text {
            font-size: 14px;
            color: #57606a;
            line-height: 1.5;
            margin: 16px 0;
          }
          .warning {
            font-size: 14px;
            color: #57606a;
            line-height: 1.5;
            margin-top: 24px;
          }
          .footer {
            padding: 24px 40px;
            border-top: 1px solid #d0d7de;
            background-color: #f6f8fa;
            text-align: center;
            font-size: 12px;
            color: #57606a;
            border-radius: 0 0 6px 6px;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-circle">🏛️</div>
          </div>
          
          <div class="content">
            <h1 class="title">Verify Your Login${firstName ? ', ' + firstName : ''}</h1>
            
            <p class="message">Welcome to the NCIP Alabel Sarangani Digital Services Portal. To complete your secure login, please enter the verification code below:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p class="info-text">⏱️ This code expires in <strong>15 minutes</strong> and can only be used once.</p>
            
            <p class="info-text">🔒 <strong>Security Reminder:</strong> Never share this code with anyone. NCIP staff will never ask for your verification code.</p>
            
            <p class="info-text">📧 <strong>Can't see this code?</strong> Please check your spam or junk folder if you don't see this email in your inbox.</p>
            
            <p class="warning">
              Thank you for using our services,<br>
              <strong>NCIP Alabel Sarangani Digital Services Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because a verification code was requested for your account at</p>
            <p><strong>NCIP Alabel Sarangani Digital Services Portal</strong></p>
            <p style="margin-top: 12px;">© 2025 National Commission on Indigenous Peoples - Alabel, Sarangani Province</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
  // Use SendGrid if available
  if (process.env.SENDGRID_API_KEY) {
    const msg = {
      to: email,
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      subject: 'NCIP Portal - Complete Your Registration',
      html: getRegistrationEmailHTML(code, firstName)
    };
    
    try {
      await sgMail.send(msg);
      console.log('✅ Registration email sent via SendGrid');
      return { success: true };
    } catch (error) {
      console.error('❌ SendGrid registration error:', error);
      return { success: false, error: error.message };
    }
  }
  
  // Fallback to SMTP
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'NCIP Portal - Complete Your Registration',
    html: getRegistrationEmailHTML(code, firstName)
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Registration email sent via SMTP:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('❌ SMTP registration error:', error);
    return { success: false, error: error.message };
  }
};

// Registration email HTML template
const getRegistrationEmailHTML = (code, firstName = '') => {
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
            background-color: #f6f8fa;
          }
          .container {
            max-width: 600px;
            margin: 40px auto;
            background-color: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 6px;
          }
          .logo {
            text-align: center;
            padding: 40px 20px 20px;
          }
          .logo-circle {
            width: 80px;
            height: 80px;
            margin: 0 auto;
            background: linear-gradient(135deg, #059669, #10b981);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 40px;
          }
          .content {
            padding: 20px 40px 40px;
            color: #24292f;
          }
          .title {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 20px;
            text-align: center;
            color: #24292f;
          }
          .message {
            font-size: 16px;
            line-height: 1.5;
            color: #57606a;
            margin-bottom: 24px;
          }
          .code-box {
            background-color: #f6f8fa;
            border: 1px solid #d0d7de;
            border-radius: 6px;
            padding: 24px;
            margin: 24px 0;
            text-align: center;
          }
          .code {
            font-size: 32px;
            font-weight: 600;
            letter-spacing: 8px;
            color: #24292f;
            font-family: 'Courier New', monospace;
          }
          .info-text {
            font-size: 14px;
            color: #57606a;
            line-height: 1.5;
            margin: 16px 0;
          }
          .warning {
            font-size: 14px;
            color: #57606a;
            line-height: 1.5;
            margin-top: 24px;
          }
          .footer {
            padding: 24px 40px;
            border-top: 1px solid #d0d7de;
            background-color: #f6f8fa;
            text-align: center;
            font-size: 12px;
            color: #57606a;
            border-radius: 0 0 6px 6px;
          }
          .footer p {
            margin: 4px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <div class="logo-circle">🏛️</div>
          </div>
          
          <div class="content">
            <h1 class="title">Welcome to NCIP Alabel Sarangani Portal${firstName ? ', ' + firstName : ''}</h1>
            
            <p class="message">Thank you for registering with the NCIP Alabel Sarangani Digital Services Portal. To complete your registration, please enter the verification code below:</p>
            
            <div class="code-box">
              <div class="code">${code}</div>
            </div>
            
            <p class="info-text">⏱️ This code expires in <strong>15 minutes</strong> and can only be used once.</p>
            
            <p class="info-text">🔒 <strong>Security Reminder:</strong> Never share this code with anyone. NCIP staff will never ask for your verification code.</p>
            
            <p class="info-text">📧 <strong>Important:</strong> If you can't find this email in your inbox, please check your spam or junk folder.</p>
            
            <p class="warning">
              Thank you for choosing our services,<br>
              <strong>NCIP Alabel Sarangani Digital Services Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>You're receiving this email because a registration was initiated for your</p>
            <p>NCIP Portal account. If this wasn't you, please ignore this email.</p>
            <p style="margin-top: 12px;">© 2024 National Commission on Indigenous Peoples - Alabel, Sarangani Province</p>
          </div>
        </div>
      </body>
      </html>
    `;
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
              <strong>NCIP Alabel Sarangani Digital Services Team</strong>
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
