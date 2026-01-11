/**
 * Email Service
 * Handles transactional emails using multiple providers.
 * Supports: Resend (primary), Nodemailer (fallback/dev)
 */

import { logger } from '../logger';

// ============================================================================
// TYPES
// ============================================================================

export interface EmailConfig {
  provider: 'resend' | 'nodemailer' | 'console';
  resendApiKey?: string;
  smtpConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  defaultFrom: string;
  replyTo?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  tags?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export const EmailTemplates = {
  /**
   * Team invitation email
   */
  teamInvite: (data: {
    name: string;
    inviterName: string;
    role: string;
    inviteUrl: string;
    expiresInDays: number;
  }) => ({
    subject: 'You\'ve been invited to join SAGE!',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">You're Invited!</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px;">Hi ${data.name || 'there'},</p>

    <p><strong>${data.inviterName}</strong> has invited you to join the SAGE team as a <strong>${data.role}</strong>.</p>

    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
      <p style="margin: 0;">As a ${data.role}, you'll be able to collaborate on landscape design projects, manage deliverables, and communicate with clients.</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.inviteUrl}" style="background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Accept Invitation
      </a>
    </div>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>This invitation expires in ${data.expiresInDays} days.</strong>
      </p>
    </div>

    <p style="color: #666; font-size: 14px;">If you didn't expect this invitation, you can safely ignore this email.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      &copy; ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
    text: `
You're Invited to Join SAGE!

Hi ${data.name || 'there'},

${data.inviterName} has invited you to join the SAGE team as a ${data.role}.

As a ${data.role}, you'll be able to collaborate on landscape design projects, manage deliverables, and communicate with clients.

Accept your invitation here:
${data.inviteUrl}

This invitation expires in ${data.expiresInDays} days.

If you didn't expect this invitation, you can safely ignore this email.

© ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    `,
  }),

  /**
   * Password reset email
   */
  passwordReset: (data: { name: string; resetUrl: string; expiresInMinutes: number }) => ({
    subject: 'Reset Your SAGE Password',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Reset Your Password</h1>
  </div>

  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px;">Hi ${data.name || 'there'},</p>

    <p>We received a request to reset your password. Click the button below to create a new password:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.resetUrl}" style="background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Reset Password
      </a>
    </div>

    <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; color: #92400e; font-size: 14px;">
        <strong>This link expires in ${data.expiresInMinutes} minutes.</strong>
      </p>
    </div>

    <p style="color: #666; font-size: 14px;">If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.</p>

    <p style="color: #666; font-size: 14px;">For security, this link can only be used once.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      &copy; ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
    text: `
Reset Your Password

Hi ${data.name || 'there'},

We received a request to reset your password. Visit the link below to create a new password:

${data.resetUrl}

This link expires in ${data.expiresInMinutes} minutes.

If you didn't request this password reset, you can safely ignore this email. Your password will remain unchanged.

For security, this link can only be used once.

© ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    `,
  }),

  /**
   * Welcome email after registration
   */
  welcome: (data: { name: string; email: string; tier: number; loginUrl: string }) => ({
    subject: 'Welcome to SAGE! 🌿',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to SAGE</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to SAGE! 🌿</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px;">Hi ${data.name || 'there'},</p>
    
    <p>Thank you for choosing SAGE for your landscape design project! We're excited to help transform your outdoor space.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
      <p style="margin: 0;"><strong>Your Plan:</strong> Tier ${data.tier}</p>
      <p style="margin: 10px 0 0 0;"><strong>Email:</strong> ${data.email}</p>
    </div>
    
    <p>To get started, access your client portal:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.loginUrl}" style="background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        Access Your Portal →
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">If you have any questions, simply reply to this email or contact our support team.</p>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
    text: `
Welcome to SAGE! 🌿

Hi ${data.name || 'there'},

Thank you for choosing SAGE for your landscape design project! We're excited to help transform your outdoor space.

Your Plan: Tier ${data.tier}
Email: ${data.email}

To get started, access your client portal:
${data.loginUrl}

If you have any questions, simply reply to this email or contact our support team.

© ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    `,
  }),

  /**
   * Payment confirmation email
   */
  paymentConfirmation: (data: { 
    name: string; 
    amount: string; 
    tier: number;
    projectName: string;
    receiptUrl?: string;
    portalUrl: string;
  }) => ({
    subject: 'Payment Confirmed - Your SAGE Project is Starting! ✨',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #0d9488 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 24px;">Payment Confirmed! ✨</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p style="font-size: 18px;">Hi ${data.name || 'there'},</p>
    
    <p>Great news! Your payment has been processed and your landscape design project is now being set up.</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin: 0 0 15px 0; color: #059669;">Order Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Project:</td>
          <td style="padding: 8px 0; text-align: right; font-weight: 600;">${data.projectName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Plan:</td>
          <td style="padding: 8px 0; text-align: right;">Tier ${data.tier}</td>
        </tr>
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 12px 0 0 0; color: #666;">Amount Paid:</td>
          <td style="padding: 12px 0 0 0; text-align: right; font-weight: 600; font-size: 18px; color: #059669;">${data.amount}</td>
        </tr>
      </table>
    </div>
    
    <h3>What's Next?</h3>
    <ol style="padding-left: 20px;">
      <li style="margin-bottom: 10px;">Our team will review your project details</li>
      <li style="margin-bottom: 10px;">You'll receive updates as milestones are completed</li>
      <li style="margin-bottom: 10px;">Track progress anytime in your portal</li>
    </ol>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.portalUrl}" style="background: #059669; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        View Your Project →
      </a>
    </div>
    
    ${data.receiptUrl ? `<p style="text-align: center;"><a href="${data.receiptUrl}" style="color: #059669;">Download Receipt</a></p>` : ''}
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    </p>
  </div>
</body>
</html>
    `,
    text: `
Payment Confirmed! ✨

Hi ${data.name || 'there'},

Great news! Your payment has been processed and your landscape design project is now being set up.

Order Details:
- Project: ${data.projectName}
- Plan: Tier ${data.tier}
- Amount Paid: ${data.amount}

What's Next?
1. Our team will review your project details
2. You'll receive updates as milestones are completed
3. Track progress anytime in your portal

View your project: ${data.portalUrl}
${data.receiptUrl ? `Download receipt: ${data.receiptUrl}` : ''}

© ${new Date().getFullYear()} SAGE Landscape Design. All rights reserved.
    `,
  }),

  /**
   * Milestone completed notification
   */
  milestoneCompleted: (data: {
    name: string;
    projectName: string;
    milestoneName: string;
    nextMilestone?: string;
    portalUrl: string;
  }) => ({
    subject: `Milestone Complete: ${data.milestoneName} ✓`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #059669; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <span style="font-size: 40px;">✓</span>
    <h1 style="color: white; margin: 10px 0 0 0; font-size: 22px;">Milestone Completed!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${data.name || 'there'},</p>
    
    <p>Great progress on your project! We've completed the following milestone:</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; border: 2px solid #059669;">
      <p style="color: #666; margin: 0 0 5px 0; font-size: 14px;">${data.projectName}</p>
      <h2 style="margin: 0; color: #059669;">${data.milestoneName}</h2>
    </div>
    
    ${data.nextMilestone ? `
    <p>Up next: <strong>${data.nextMilestone}</strong></p>
    ` : '<p>This was the final milestone! Your project is now complete. 🎉</p>'}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.portalUrl}" style="background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
        View Details →
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} SAGE Landscape Design
    </p>
  </div>
</body>
</html>
    `,
    text: `
Milestone Completed! ✓

Hi ${data.name || 'there'},

Great progress on your project! We've completed the following milestone:

${data.projectName}
${data.milestoneName}

${data.nextMilestone ? `Up next: ${data.nextMilestone}` : 'This was the final milestone! Your project is now complete. 🎉'}

View details: ${data.portalUrl}

© ${new Date().getFullYear()} SAGE Landscape Design
    `,
  }),

  /**
   * New deliverable available
   */
  deliverableReady: (data: {
    name: string;
    projectName: string;
    deliverableName: string;
    downloadUrl: string;
    portalUrl: string;
  }) => ({
    subject: `New Deliverable: ${data.deliverableName} 📦`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <span style="font-size: 40px;">📦</span>
    <h1 style="color: white; margin: 10px 0 0 0; font-size: 22px;">New Deliverable Ready!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
    <p>Hi ${data.name || 'there'},</p>
    
    <p>A new deliverable is ready for your project:</p>
    
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
      <p style="color: #666; margin: 0 0 5px 0; font-size: 14px;">${data.projectName}</p>
      <h3 style="margin: 0; color: #2563eb;">${data.deliverableName}</h3>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${data.downloadUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; margin-right: 10px;">
        Download Now
      </a>
      <a href="${data.portalUrl}" style="background: white; color: #2563eb; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; border: 2px solid #2563eb;">
        View in Portal
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
    
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      © ${new Date().getFullYear()} SAGE Landscape Design
    </p>
  </div>
</body>
</html>
    `,
    text: `
New Deliverable Ready! 📦

Hi ${data.name || 'there'},

A new deliverable is ready for your project:

${data.projectName}
${data.deliverableName}

Download: ${data.downloadUrl}
View in Portal: ${data.portalUrl}

© ${new Date().getFullYear()} SAGE Landscape Design
    `,
  }),
};

// ============================================================================
// EMAIL SERVICE IMPLEMENTATION
// ============================================================================

let emailConfig: EmailConfig | null = null;

/**
 * Initialize the email service
 */
export function initEmailService(config: EmailConfig): void {
  emailConfig = config;
  logger.info(`Email service initialized with provider: ${config.provider}`);
}

/**
 * Send an email
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  if (!emailConfig) {
    logger.warn('Email service not initialized, using console provider');
    return sendViaConsole(options);
  }

  const emailOptions: EmailOptions = {
    ...options,
    from: options.from || emailConfig.defaultFrom,
    replyTo: options.replyTo || emailConfig.replyTo,
  };

  switch (emailConfig.provider) {
    case 'resend':
      return sendViaResend(emailOptions);
    case 'nodemailer':
      return sendViaNodemailer(emailOptions);
    case 'console':
    default:
      return sendViaConsole(emailOptions);
  }
}

/**
 * Send via Resend API
 */
async function sendViaResend(options: EmailOptions): Promise<EmailResult> {
  if (!emailConfig?.resendApiKey) {
    logger.error('Resend API key not configured');
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${emailConfig.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from,
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        tags: options.tags?.map(tag => ({ name: tag, value: 'true' })),
      }),
    });

    const data = await response.json() as { id?: string; message?: string };

    if (!response.ok) {
      logger.error('Resend API error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    logger.info(`Email sent via Resend: ${data.id}`);
    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error('Resend send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send via Nodemailer (SMTP)
 */
async function sendViaNodemailer(options: EmailOptions): Promise<EmailResult> {
  // Dynamic import to avoid requiring nodemailer when not used
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer') as typeof import('nodemailer');
    
    if (!emailConfig?.smtpConfig) {
      return { success: false, error: 'SMTP config not provided' };
    }

    const transporter = nodemailer.createTransport(emailConfig.smtpConfig);

    const info = await transporter.sendMail({
      from: options.from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    logger.info(`Email sent via Nodemailer: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Nodemailer send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Console provider for development
 */
async function sendViaConsole(options: EmailOptions): Promise<EmailResult> {
  const messageId = `console-${Date.now()}`;
  
  logger.info('='.repeat(60));
  logger.info('📧 EMAIL (Console Provider)');
  logger.info('='.repeat(60));
  logger.info(`To: ${Array.isArray(options.to) ? options.to.join(', ') : options.to}`);
  logger.info(`From: ${options.from || 'not set'}`);
  logger.info(`Subject: ${options.subject}`);
  logger.info('-'.repeat(60));
  logger.info('Text Content:');
  logger.info(options.text || '(no text content)');
  logger.info('='.repeat(60));
  
  return { success: true, messageId };
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(data: {
  to: string;
  name: string;
  tier: number;
  loginUrl?: string;
}): Promise<EmailResult> {
  const template = EmailTemplates.welcome({
    name: data.name,
    email: data.to,
    tier: data.tier,
    loginUrl: data.loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['welcome', `tier-${data.tier}`],
  });
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmation(data: {
  to: string;
  name: string;
  amount: number;
  currency: string;
  tier: number;
  projectName: string;
  projectId: string;
  receiptUrl?: string;
}): Promise<EmailResult> {
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: data.currency.toUpperCase(),
  }).format(data.amount / 100);

  const template = EmailTemplates.paymentConfirmation({
    name: data.name,
    amount: formattedAmount,
    tier: data.tier,
    projectName: data.projectName,
    receiptUrl: data.receiptUrl,
    portalUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/projects/${data.projectId}`,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['payment', `tier-${data.tier}`],
  });
}

/**
 * Send milestone completion notification
 */
export async function sendMilestoneNotification(data: {
  to: string;
  name: string;
  projectName: string;
  projectId: string;
  milestoneName: string;
  nextMilestone?: string;
}): Promise<EmailResult> {
  const template = EmailTemplates.milestoneCompleted({
    name: data.name,
    projectName: data.projectName,
    milestoneName: data.milestoneName,
    nextMilestone: data.nextMilestone,
    portalUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/projects/${data.projectId}`,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['milestone', 'notification'],
  });
}

/**
 * Send deliverable notification
 */
export async function sendDeliverableNotification(data: {
  to: string;
  name: string;
  projectName: string;
  projectId: string;
  deliverableName: string;
  downloadUrl: string;
}): Promise<EmailResult> {
  const template = EmailTemplates.deliverableReady({
    name: data.name,
    projectName: data.projectName,
    deliverableName: data.deliverableName,
    downloadUrl: data.downloadUrl,
    portalUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/portal/projects/${data.projectId}`,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['deliverable', 'notification'],
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(data: {
  to: string;
  name: string;
  resetToken: string;
  expiresInMinutes?: number;
}): Promise<EmailResult> {
  const expiresInMinutes = data.expiresInMinutes || 60;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const resetUrl = `${frontendUrl}/reset-password?token=${data.resetToken}`;

  const template = EmailTemplates.passwordReset({
    name: data.name,
    resetUrl,
    expiresInMinutes,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['password-reset', 'security'],
  });
}

/**
 * Send team invitation email
 */
export async function sendTeamInviteEmail(data: {
  to: string;
  name: string;
  inviterName: string;
  role: string;
  inviteToken: string;
  expiresInDays?: number;
}): Promise<EmailResult> {
  const expiresInDays = data.expiresInDays || 7;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const inviteUrl = `${frontendUrl}/accept-invite?token=${data.inviteToken}`;

  const template = EmailTemplates.teamInvite({
    name: data.name,
    inviterName: data.inviterName,
    role: data.role,
    inviteUrl,
    expiresInDays,
  });

  return sendEmail({
    to: data.to,
    subject: template.subject,
    html: template.html,
    text: template.text,
    tags: ['team-invite', 'onboarding'],
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  initEmailService,
  sendEmail,
  sendWelcomeEmail,
  sendPaymentConfirmation,
  sendMilestoneNotification,
  sendDeliverableNotification,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  EmailTemplates,
};
