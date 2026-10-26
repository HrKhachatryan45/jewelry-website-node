// Port of bakery_app/email_templates.py + utils.py (send_order_email, send_contact_email).
import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { DELIVERY_LABELS, PAYMENT_LABELS } from './serializers.js';

const LUXE_STYLE = `
  body { font-family:Arial,sans-serif; background-color:#f3f4f6; margin:0; padding:0; color:#374151; }
  .wrapper { width:100%; background-color:#f3f4f6; padding:32px 12px 40px; }
  .main { background-color:#ffffff; margin:0 auto; width:100%; max-width:600px; color:#374151; border:1px solid #e5e7eb; border-collapse:collapse; }
  .header { padding:32px 20px; text-align:center; background-color:#ffffff; border-bottom:3px solid #d4af37; }
  .content { padding:32px 30px; line-height:1.75; font-size:15px; color:#4b5563; }
  .title { font-family:Georgia,serif; font-size:24px; color:#202a36; margin:0 0 20px; text-transform:uppercase; letter-spacing:2px; text-align:center; }
  .gold-text { color:#a87900; font-weight:700; }
  .divider { height:1px; background-color:#e5e7eb; margin:26px 0; }
  .footer { padding:24px 20px; text-align:center; font-size:12px; line-height:1.7; color:#6b7280; background-color:#f9fafb; border-top:1px solid #e5e7eb; }
  .button { display:inline-block; padding:14px 30px; background-color:#d4af37; color:#111827 !important; text-decoration:none; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:1.3px; }
  .order-table { width:100%; border-collapse:collapse; margin:20px 0; }
  .order-table th { text-align:left; padding:12px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#202a36; background-color:#f9fafb; border-bottom:2px solid #d4af37; }
  .order-table td { padding:12px; border-bottom:1px solid #e5e7eb; font-size:14px; color:#374151; }
`;

function compose(content, siteUrl) {
  const year = new Date().getFullYear();
  const header = `<div class="header"><h1 style="font-family:Georgia,serif;color:#202a36;margin:0;font-size:28px;letter-spacing:4px;text-transform:uppercase;">LUXE <span style="color:#a87900;">JEWELRY</span></h1></div>`;
  const footer = `<div class="footer"><p style="margin:0 0 8px;">© ${year} LUXE JEWELRY. ԲՈԼՈՐ ԻՐԱՎՈՒՆՔՆԵՐԸ ՊԱՇՏՊԱՆՎԱԾ ԵՆ։</p><p style="margin:0;">Երևան, Հայաստան | <a href="${siteUrl}" style="color:#202a36;font-weight:600;">www.luxejewelry.am</a></p></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${LUXE_STYLE}</style></head><body><div class="wrapper"><table class="main" role="presentation" cellpadding="0" cellspacing="0"><tr><td>${header}<div class="content">${content}</div>${footer}</td></tr></table></div></body></html>`;
}

function orderTable(items) {
  const rows = (items || [])
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center;">${i.quantity}</td><td style="text-align:right;color:#a87900;font-weight:700;">${i.price} ֏</td></tr>`
    )
    .join('');
  return `<table class="order-table"><thead><tr><th>Անուն</th><th>Քանակ</th><th>Գին</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export const Templates = {
  OrderReceived(order) {
    const total = order.total;
    return {
      subject: 'Ձեր պատվերը ստացվել է | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ՊԱՏՎԵՐԻ ՍՏԱՑՈՒՄ</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Շնորհակալություն «Luxe Jewelry»-ից գնումներ կատարելու համար: Մենք ստացել ենք Ձեր պատվերը:</p>
        <div class="divider"></div>
        <table class="order-table">
          <tr><td>Պատվերի համար:</td><td class="gold-text">#${order.id}</td></tr>
          <tr><td>Առաքման տեսակ:</td><td>${DELIVERY_LABELS[order.deliveryType] || order.deliveryType}</td></tr>
          <tr><td>Վճարման եղանակ:</td><td class="gold-text">${PAYMENT_LABELS[order.paymentMethod] || order.paymentMethod}</td></tr>
        </table>
        ${orderTable(order?.items)}
        <p style="text-align:center;">Ընդհանուր՝ <span class="gold-text">${total} ֏</span></p>`,
        env.hostUrl
      ),
    };
  },
  OrderConfirmed(order) {
    return {
      subject: 'Ձեր պատվերը հաստատված է | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ՊԱՏՎԵՐԻ ՀԱՍՏԱՏՈՒՄ</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր <span class="gold-text">#${order.id}</span> պատվերը հաստատվել է:</p>
        <div class="divider"></div>${orderTable(order?.items)}`,
        env.hostUrl
      ),
    };
  },
  OrderPaymentSuccess(order) {
    return {
      subject: 'Վճարումը հաջողությամբ կատարվել է | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ՎՃԱՐՈՒՄԸ ՀԱՍՏԱՏՎԱԾ Է</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր <span class="gold-text">#${order.id}</span> պատվերի վճարումը հաջողությամբ ստացվել է:</p>`,
        env.hostUrl
      ),
    };
  },
  OrderPaymentFailed(order) {
    return {
      subject: 'Վճարման սխալ | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ՎՃԱՐՄԱՆ ՍԽԱԼ</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր <span class="gold-text">#${order.id}</span> պատվերի առցանց վճարումը չհաջողվեց:</p>
        <div style="text-align:center;margin-top:32px;"><a href="${env.hostUrl}/checkout/?order_id=${order.id}" class="button">Փորձել կրկին</a></div>`,
        env.hostUrl
      ),
    };
  },
  OrderReady(order) {
    return {
      subject: 'Ձեր զարդը պատրաստ է | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ՊԱՏՎԵՐԸ ՊԱՏՐԱՍՏ Է</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր <span class="gold-text">#${order.id}</span> պատվերը պատրաստ է:</p>`,
        env.hostUrl
      ),
    };
  },
  OrderDelivered(order) {
    return {
      subject: 'Պատվերը հաջողությամբ առաքվել է | Luxe Jewelry',
      body: compose(
        `<h2 class="title">ԱՌԱՔՈՒՄԸ ԿԱՏԱՐՎԱԾ Է</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր պատվերը հաջողությամբ առաքվել է:</p>`,
        env.hostUrl
      ),
    };
  },
  OrderNotification(order) {
    return {
      subject: '🔔 Նոր պատվեր | Luxe Jewelry',
      body: compose(
        `<h2 class="title">🔔 ՆՈՐ ՊԱՏՎԵՐ</h2>
        <p>Ստացվել է նոր պատվեր <span class="gold-text">#${order.id}</span>:</p>
        <table class="order-table">
          <tr><td>Հաճախորդ:</td><td class="gold-text">${order.fullName}</td></tr>
          <tr><td>Հեռախոս:</td><td>${order.phone}</td></tr>
          <tr><td>Էլ. փոստ:</td><td>${order.email}</td></tr>
          <tr><td>Գումար:</td><td class="gold-text">${order.total} ֏</td></tr>
        </table>
        <div style="text-align:center;"><a href="${env.hostUrl}/admin/#/orders/${order.id}" class="button">Դիտել պատվերը</a></div>`,
        env.hostUrl
      ),
    };
  },
  UserMessage(msg) {
    return {
      subject: '📬 Նոր հաղորդագրություն | Luxe Jewelry',
      body: compose(
        `<h2 class="title">📬 ՆՈՐ ՀԱՂՈՐԴԱԳՐՈՒԹՅՈՒՆ</h2>
        <table class="order-table">
          <tr><td>Անուն:</td><td class="gold-text">${msg.name}</td></tr>
          <tr><td>Էլ. փոստ:</td><td>${msg.email}</td></tr>
          <tr><td>Հեռախոս:</td><td>${msg.phone || '-'}</td></tr>
        </table>
        <div style="background:#f9fafb;padding:22px;border-left:3px solid #d4af37;"><p style="color:#374151;margin:0;">${msg.message}</p></div>`,
        env.hostUrl
      ),
    };
  },
};

let transporter;
function getTransporter() {
  if (!env.email.user || !env.email.password) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: { user: env.email.user, pass: env.email.password },
    });
  }
  return transporter;
}

async function send(to, { subject, body }) {
  const tx = getTransporter();
  const recipients = Array.isArray(to) ? to : [to];
  if (!tx) {
    // eslint-disable-next-line no-console
    console.warn(`[email] SMTP not configured; skipping "${subject}" -> ${recipients.join(', ')}`);
    return false;
  }
  await tx.sendMail({ from: env.email.from, to: recipients.join(','), subject, html: body });
  return true;
}

export async function sendOrderEmail(to, order, templateFn) {
  try {
    return await send(to, templateFn(order));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] order email failed:', err.message);
    return false;
  }
}

export async function sendContactEmail(to, msg) {
  try {
    return await send(to, Templates.UserMessage(msg));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] contact email failed:', err.message);
    return false;
  }
}

// Map order status -> template (custom_admin_views.send_order_status_email)
export const STATUS_TEMPLATES = {
  confirmed: Templates.OrderConfirmed,
  ready: Templates.OrderReady,
  delivered: Templates.OrderDelivered,
};
