import { Resend } from 'resend';
import { EmailFailureLogger } from './emailFailureLogger';

// Initialize Resend with API key from environment variables
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface OrderEmailData {
  orderId: string;
  orderNumber: string;
  email: string;
  shippingName: string;
  shippingLine1: string;
  shippingLine2?: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  productName: string;
  amountTotal: number;
  currency: string;
}

interface ShippingNotificationData {
  email: string;
  orderId: string;
  orderNumber: string;
  trackingNumber?: string;
  trackingUrl?: string;
  productName: string;
}

interface DoseReminderEmailData {
  email: string;
  name?: string;
  peptideName: string;
  dosage?: string;
  reminderTime: Date;
}

/**
 * Send order confirmation email to customer
 */
export async function sendOrderConfirmationEmail(data: OrderEmailData) {
  if (!resend) {
    console.warn('[email] Resend not configured, skipping order confirmation email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const amount = (data.amountTotal / 100).toFixed(2);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Order Confirmation - Reset Biology</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <!-- Header -->
                  <tr>
                    <td style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Order Confirmed!</h1>
                    </td>
                  </tr>

                  <!-- Content -->
                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                        Hi <strong>${data.shippingName}</strong>,
                      </p>

                      <p style="margin: 0 0 30px; font-size: 16px; color: #374151; line-height: 1.6;">
                        Thank you for your order! We've received your payment and will process your order shortly.
                      </p>

                      <!-- Order Details -->
                      <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h2 style="margin: 0 0 15px; font-size: 18px; color: #111827; font-weight: 600;">Order Details</h2>
                        <table width="100%" cellpadding="5" cellspacing="0">
                          <tr>
                            <td style="color: #6b7280; font-size: 14px;">Order Number:</td>
                            <td style="color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${data.orderNumber}</td>
                          </tr>
                          <tr>
                            <td style="color: #6b7280; font-size: 14px;">Product:</td>
                            <td style="color: #111827; font-size: 14px; text-align: right;">${data.productName}</td>
                          </tr>
                          <tr>
                            <td style="color: #6b7280; font-size: 14px;">Total:</td>
                            <td style="color: #111827; font-size: 16px; font-weight: 700; text-align: right;">$${amount} ${data.currency.toUpperCase()}</td>
                          </tr>
                        </table>
                      </div>

                      <!-- Shipping Address -->
                      <div style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 30px;">
                        <h2 style="margin: 0 0 15px; font-size: 18px; color: #111827; font-weight: 600;">Shipping Address</h2>
                        <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                          ${data.shippingName}<br>
                          ${data.shippingLine1}<br>
                          ${data.shippingLine2 ? `${data.shippingLine2}<br>` : ''}
                          ${data.shippingCity}, ${data.shippingState} ${data.shippingPostalCode}<br>
                          ${data.shippingCountry}
                        </p>
                      </div>

                      <p style="margin: 0 0 20px; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        You'll receive another email with tracking information once your order ships.
                      </p>

                      <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        If you have any questions, reply to this email or visit our support page.
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 10px; font-size: 12px; color: #9ca3af;">
                        Reset Biology<br>
                        © ${new Date().getFullYear()} All rights reserved
                      </p>
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        <a href="https://resetbiology.com" style="color: #0d9488; text-decoration: none;">Visit our website</a>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: 'Reset Biology <orders@resetbiology.com>',
      to: data.email,
      subject: `Order Confirmation - ${data.orderNumber}`,
      html: emailHtml,
    });

    console.log('[email] Order confirmation sent to', data.email, result);
    return { success: true, data: result };
  } catch (error: any) {
    // Log failure to database
    await EmailFailureLogger.logFailure({
      emailType: 'order-confirmation',
      recipient: data.email,
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      payload: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        productName: data.productName,
        amountTotal: data.amountTotal
      }
    });

    console.error('[email] Failed to send order confirmation:', error);
    return { success: false, error };
  }
}

/**
 * Get order notification email recipients
 * Supports multiple emails via comma-separated SELLER_EMAILS env var
 * Falls back to SELLER_EMAIL for backwards compatibility
 */
function getOrderNotificationRecipients(): string[] {
  // First check SELLER_EMAILS (plural, comma-separated)
  const multipleEmails = process.env.SELLER_EMAILS;
  if (multipleEmails) {
    return multipleEmails.split(',').map(e => e.trim()).filter(Boolean);
  }

  // Fall back to single SELLER_EMAIL
  const singleEmail = process.env.SELLER_EMAIL || 'jonchyatt@gmail.com';
  return [singleEmail];
}

/**
 * Send new order notification to seller(s)
 * Supports multiple recipients via SELLER_EMAILS env var (comma-separated)
 */
export async function sendSellerOrderNotification(data: OrderEmailData) {
  if (!resend) {
    console.warn('[email] Resend not configured, skipping seller notification');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const amount = (data.amountTotal / 100).toFixed(2);
    const recipients = getOrderNotificationRecipients();

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Order - Reset Biology</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">🎉 New Order Received!</h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 30px;">
                      <h2 style="margin: 0 0 20px; font-size: 18px; color: #111827;">Order #${data.orderNumber}</h2>

                      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 14px; color: #78350f; font-weight: 600;">
                          Action Required: Process and fulfill this order
                        </p>
                      </div>

                      <table width="100%" cellpadding="8" cellspacing="0" style="border: 1px solid #e5e7eb; border-radius: 6px;">
                        <tr style="background-color: #f9fafb;">
                          <td colspan="2" style="padding: 12px; font-size: 14px; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb;">
                            Order Details
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">Product:</td>
                          <td style="padding: 8px 12px; font-size: 13px; color: #111827; font-weight: 600;">${data.productName}</td>
                        </tr>
                        <tr style="background-color: #f9fafb;">
                          <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">Amount:</td>
                          <td style="padding: 8px 12px; font-size: 14px; color: #111827; font-weight: 700;">$${amount} ${data.currency.toUpperCase()}</td>
                        </tr>
                        <tr>
                          <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">Customer Email:</td>
                          <td style="padding: 8px 12px; font-size: 13px; color: #111827;">${data.email}</td>
                        </tr>
                      </table>

                      <h3 style="margin: 25px 0 10px; font-size: 16px; color: #111827;">Shipping Address</h3>
                      <div style="background-color: #f9fafb; border-radius: 6px; padding: 15px;">
                        <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
                          <strong>${data.shippingName}</strong><br>
                          ${data.shippingLine1}<br>
                          ${data.shippingLine2 ? `${data.shippingLine2}<br>` : ''}
                          ${data.shippingCity}, ${data.shippingState} ${data.shippingPostalCode}<br>
                          ${data.shippingCountry}
                        </p>
                      </div>

                      <div style="margin-top: 30px; text-align: center;">
                        <a href="https://resetbiology.com/admin/orders" style="display: inline-block; background-color: #0d9488; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                          View Order in Admin Panel
                        </a>
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="background-color: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                        This is an automated notification from Reset Biology
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    // Send to all recipients
    const result = await resend.emails.send({
      from: 'Reset Biology Orders <orders@resetbiology.com>',
      to: recipients,
      subject: `🎉 New Order #${data.orderNumber}`,
      html: emailHtml,
    });

    console.log('[email] Seller notification sent to', recipients.join(', '), result);
    return { success: true, data: result, recipients };
  } catch (error: any) {
    const recipients = getOrderNotificationRecipients();

    // Log failure to database
    await EmailFailureLogger.logFailure({
      emailType: 'seller-notification',
      recipient: recipients.join(', '),
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      payload: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        productName: data.productName,
        amountTotal: data.amountTotal
      }
    });

    console.error('[email] Failed to send seller notification:', error);
    return { success: false, error };
  }
}

/**
 * Send shipping confirmation email to customer
 */
export async function sendShippingConfirmationEmail(data: ShippingNotificationData) {
  if (!resend) {
    console.warn('[email] Resend not configured, skipping shipping confirmation email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const trackingInfo = data.trackingUrl
      ? `<p style="margin: 20px 0; text-align: center;">
           <a href="${data.trackingUrl}" style="display: inline-block; background-color: #0d9488; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
             Track Your Package
           </a>
         </p>`
      : data.trackingNumber
      ? `<p style="margin: 20px 0; font-size: 14px; color: #374151;">
           <strong>Tracking Number:</strong> ${data.trackingNumber}
         </p>`
      : '';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Order Shipped - Reset Biology</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 40px 20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); padding: 40px; text-align: center; border-radius: 8px 8px 0 0;">
                      <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📦 Your Order Has Shipped!</h1>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding: 40px;">
                      <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                        Great news! Your order has been shipped and is on its way to you.
                      </p>

                      <div style="background-color: #f0fdfa; border-radius: 6px; padding: 20px; margin-bottom: 30px; border: 1px solid #99f6e4;">
                        <p style="margin: 0 0 8px; font-size: 12px; color: #0f766e; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Order Number</p>
                        <p style="margin: 0; font-size: 18px; color: #115e59; font-weight: 700;">${data.orderNumber}</p>
                      </div>

                      ${trackingInfo}

                      <p style="margin: 30px 0 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                        If you have any questions about your order, please don't hesitate to contact us.
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-radius: 0 0 8px 8px; border-top: 1px solid #e5e7eb;">
                      <p style="margin: 0 0 10px; font-size: 12px; color: #9ca3af;">
                        Reset Biology<br>
                        © ${new Date().getFullYear()} All rights reserved
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: 'Reset Biology <orders@resetbiology.com>',
      to: data.email,
      subject: `Your Order Has Shipped - ${data.orderNumber}`,
      html: emailHtml,
    });

    console.log('[email] Shipping confirmation sent to', data.email, result);
    return { success: true, data: result };
  } catch (error: any) {
    // Log failure to database
    await EmailFailureLogger.logFailure({
      emailType: 'shipping-confirmation',
      recipient: data.email,
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      payload: {
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        productName: data.productName,
        trackingNumber: data.trackingNumber,
        trackingUrl: data.trackingUrl
      }
    });

    console.error('[email] Failed to send shipping confirmation:', error);
    return { success: false, error };
  }
}

export async function sendDoseReminderEmail(data: DoseReminderEmailData) {
  if (!resend) {
    console.warn('[email] Resend not configured, skipping dose reminder email');
    return { success: false, error: 'Email service not configured' };
  }

  const localTime = data.reminderTime.toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; background: #f7f9fb;">
      <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);">
        <p style="font-size: 15px; color: #0f172a; margin: 0 0 20px;">Hi ${data.name || 'Reset Biology member'},</p>
        <p style="font-size: 15px; color: #0f172a; line-height: 1.6;">
          This is your reminder to take your <strong>${data.peptideName}</strong>${data.dosage ? ` (${data.dosage})` : ''}.
          Staying consistent keeps your protocol on track.
        </p>
        <div style="margin: 24px 0; padding: 16px; border-radius: 10px; background: #ecfeff; border: 1px solid #06b6d4;">
          <strong style="display: block; color: #0f172a; font-size: 15px;">Scheduled Dose</strong>
          <div style="font-size: 24px; font-weight: 600; color: #0f172a; margin-top: 6px;">${localTime}</div>
        </div>

        <!-- PWA App Instructions -->
        <div style="margin: 24px 0; padding: 16px; border-radius: 10px; background: #f0f9ff; border: 1px solid #0ea5e9;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 20px;">📱</span>
            <strong style="color: #0f172a; font-size: 14px;">Open in App</strong>
          </div>
          <p style="font-size: 13px; color: #475569; line-height: 1.5; margin: 0;">
            For the best experience, <strong>open the Reset Biology app from your home screen</strong> instead of clicking the link below. You'll stay logged in and get faster access to your protocols.
          </p>
        </div>

        <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 16px 0;">
          Don't have the app on your home screen yet? Visit <a href="https://resetbiology.com" style="color: #0ea5e9; text-decoration: none;">resetbiology.com</a> and tap "Add to Home Screen" (iOS) or "Install" (Android).
        </p>

        <div style="text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
          <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px;">
            Or open in browser (you may need to log in again):
          </p>
          <a href="https://resetbiology.com/peptides" style="display: inline-block; padding: 10px 24px; background: #e2e8f0; color: #475569; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 500;">Open in Browser</a>
        </div>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 24px; line-height: 1.5;">
        You receive these reminders because notifications are enabled in your Reset Biology peptide protocol.<br>
        To change notification settings, open the app and tap "Remind Me" on your protocol.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Reset Biology <orders@resetbiology.com>', // Use verified sender (same as order emails)
      to: data.email,
      subject: `Peptide reminder – ${data.peptideName}`,
      html,
    });

    return { success: true };
  } catch (error: any) {
    // Log failure to database
    await EmailFailureLogger.logFailure({
      emailType: 'dose-reminder',
      recipient: data.email,
      errorMessage: error.message,
      errorCode: error.code,
      errorStack: error.stack,
      payload: {
        peptideName: data.peptideName,
        dosage: data.dosage,
        reminderTime: data.reminderTime
      }
    });

    console.error('[email] Dose reminder failed:', error);
    return { success: false, error };
  }
}
