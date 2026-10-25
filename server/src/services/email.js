// Port of bakery_app/email_templates.py + utils.py (send_order_email, send_contact_email).
import nodemailer from 'nodemailer';
import env from '../config/env.js';
import { DELIVERY_LABELS, PAYMENT_LABELS } from './serializers.js';

const LUXE_STYLE = `
  body { font-family: 'Inter', Arial, sans-serif; background-color:#0a0a0a; margin:0; padding:0; color:#fff; }
  .wrapper { width:100%; background-color:#0a0a0a; padding-bottom:40px; }
  .main { background-color:#0d0d0d; margin:0 auto; width:100%; max-width:600px; color:#fff; border:1px solid #1a1a1a; }
  .header { padding:40px 0; text-align:center; background-color:#0d0d0d; border-bottom:1px solid #1a1a1a; }
  .content { padding:40px 30px; line-height:1.8; font-size:15px; color:rgba(255,255,255,0.7); }
  .title { font-family:'Playfair Display', serif; font-size:24px; color:#fff; margin-bottom:20px; text-transform:uppercase; letter-spacing:2px; text-align:center; }
  .gold-text { color:#d4af37; font-weight:600; }
  .divider { height:1px; background-color:rgba(212,175,55,0.2); margin:30px 0; }
  .footer { padding:30px; text-align:center; font-size:12px; color:rgba(255,255,255,0.3); border-top:1px solid #1a1a1a; }
  .button { display:inline-block; padding:15px 35px; background-color:#d4af37; color:#000 !important; text-decoration:none; font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:1.5px; }
  .order-table { width:100%; border-collapse:collapse; margin:20px 0; }
  .order-table th { text-align:left; padding:12px; font-size:12px; text-transform:uppercase; color:#d4af37; border-bottom:1px solid rgba(255,255,255,0.1); }
  .order-table td { padding:12px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:14px; }
`;

function compose(content, siteUrl) {
  const year = new Date().getFullYear();
  const header = `<div class="header"><h1 style="font-family:'Playfair Display',serif;color:#fff;margin:0;font-size:28px;letter-spacing:4px;text-transform:uppercase;">LUXE <span style="color:#d4af37;">JEWELRY</span></h1></div>`;
  const footer = `<div class="footer"><p>© ${year} LUXE JEWELRY. ԲՈԼՈՐ ԻՐԱՎՈՒՆՔՆԵՐԸ ՊԱՇՏՊԱՆՎԱԾ ԵՆ։</p><p>Երևան, Հայաստան | <a href="${siteUrl}" style="color:#d4af37;">www.luxejewelry.am</a></p></div>`;
  return `<!DOCTYPE html><html><head><style>${LUXE_STYLE}</style></head><body><div class="wrapper"><table class="main"><tr><td>${header}<div class="content">${content}</div>${footer}</td></tr></table></div></body></html>`;
}

function orderTable(items) {
  const rows = (items || [])
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center;">${i.quantity}</td><td style="text-align:right;color:#d4af37;">${i.price} ֏</td></tr>`
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
        `<h2 class="title" style="color:#4ade80;">ՎՃԱՐՈՒՄԸ ՀԱՍՏԱՏՎԱԾ Է</h2>
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
        `<h2 class="title" style="color:#ef4444;">ՎՃԱՐՄԱՆ ՍԽԱԼ</h2>
        <p>Հարգելի <span class="gold-text">${order.fullName}</span>,</p>
        <p>Ձեր <span class="gold-text">#${order.id}</span> պատվերի առցանց վճարումը չհաջողվեց:</p>
        <div style="text-align:center;margin-top:40px;"><a href="${env.hostUrl}/checkout/?order_id=${order.id}" class="button" style="background-color:#ef4444;color:#fff !important;">Փորձել կրկին</a></div>`,
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
        `<h2 class="title" style="color:#d4af37;">🔔 ՆՈՐ ՊԱՏՎԵՐ</h2>
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
        <div style="background:rgba(255,255,255,0.02);padding:25px;border-left:3px solid #d4af37;"><p style="color:#fff;">${msg.message}</p></div>`,
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
