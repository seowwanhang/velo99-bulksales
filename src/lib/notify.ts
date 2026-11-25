import { formatRM } from './rules';

interface OrderEmailPayload {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  dealerTier: string;
  regionName: string;
  hubName: string;
  fulfillment: string;
  paymentMethod: string;
  totalBikes: number;
  totalCartons: number;
  totalCbm: number;
  totalAmount: number;
  requestEInvoice: boolean;
  eInvoiceCompany: string;
  eInvoiceTin: string;
  brandName: string;
  toEmail: string;
}

/**
 * Sends an instant wholesale order alert email via Resend (Free tier: 3,000 emails/month).
 * Fails silently with a console log when RESEND_API_KEY is not configured so checkout never breaks.
 */
export async function sendOrderEmailNotification(payload: OrderEmailPayload) {
  const apiKey = process.env.RESEND_API_KEY;
  const recipient = (payload.toEmail || process.env.NOTIFY_EMAIL || '').trim();
  const from = process.env.RESEND_FROM_EMAIL || 'Velo99 Orders <onboarding@resend.dev>';
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

  if (!apiKey || !recipient) {
    console.log(
      `[OrderAlert] Skipped email for ${payload.orderNumber} (set RESEND_API_KEY and notifyEmail to activate live emails).`
    );
    return { sent: false, reason: 'not_configured' };
  }

  const invoiceLink = siteUrl
    ? `${siteUrl}/invoice/${payload.orderNumber}`
    : `/invoice/${payload.orderNumber}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;color:#17191f;">
      <h2 style="margin:0 0 8px;color:#d94e1f;">New Wholesale Order: ${payload.orderNumber}</h2>
      <p style="margin:0 0 14px;color:#555;">Received on ${payload.brandName}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#666;">Buyer / Company</td><td style="padding:6px 0;font-weight:bold;">${payload.customerName} (${payload.dealerTier.toUpperCase()})</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Phone / Email</td><td style="padding:6px 0;">${payload.customerPhone} ${payload.customerEmail ? `• ${payload.customerEmail}` : ''}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Fulfillment</td><td style="padding:6px 0;">${payload.fulfillment === 'pickup' ? `Hub Self-Pickup (${payload.hubName})` : `Lorry Delivery (${payload.regionName})`}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Payment Method</td><td style="padding:6px 0;">${payload.paymentMethod.replace(/_/g, ' ').toUpperCase()}</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Volume</td><td style="padding:6px 0;">${payload.totalCartons} cartons • ${payload.totalBikes} bikes • ${payload.totalCbm.toFixed(2)} m³</td></tr>
        <tr><td style="padding:6px 0;color:#666;">Total Receivable</td><td style="padding:6px 0;font-size:16px;font-weight:bold;color:#15803d;">${formatRM(payload.totalAmount)}</td></tr>
        ${payload.requestEInvoice ? `<tr><td style="padding:6px 0;color:#666;">LHDN e-Invoice</td><td style="padding:6px 0;">${payload.eInvoiceCompany} (TIN: ${payload.eInvoiceTin})</td></tr>` : ''}
      </table>
      <p style="margin-top:18px;">
        <a href="${invoiceLink}" style="display:inline-block;background:#d94e1f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold;">Open Formal Invoice</a>
      </p>
    </div>
  `;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [recipient],
        subject: `[${payload.brandName}] New Order ${payload.orderNumber} — ${formatRM(payload.totalAmount)}`,
        html,
      }),
    });
    if (!res.ok) {
      console.error('[OrderAlert] Resend API error:', await res.text());
      return { sent: false, reason: 'api_error' };
    }
    return { sent: true };
  } catch (err) {
    console.error('[OrderAlert] Network error:', err);
    return { sent: false, reason: 'network_error' };
  }
}
