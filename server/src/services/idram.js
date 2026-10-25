// Port of views.initiate_payment (idram), idram_result, idram_success/fail.
import crypto from 'node:crypto';
import env from '../config/env.js';

export const IDRAM_PAYMENT_URL = 'https://banking.idram.am/Payment/GetPayment';

// Params for bakery/idram_payment.html hidden form.
export function buildPaymentParams(order) {
  return {
    EDP_LANGUAGE: 'AM',
    EDP_REC_ACCOUNT: env.idram.account,
    EDP_DESCRIPTION: `Պատվեր #${order.id}`,
    EDP_AMOUNT: Number(order.total).toFixed(2),
    EDP_BILL_NO: String(order.id),
    EDP_EMAIL: order.email,
  };
}

// idram_result: precheck branch
export function verifyPrecheck(body) {
  const billNo = body.EDP_BILL_NO;
  const amountStr = body.EDP_AMOUNT;
  const idramId = (body.EDP_REC_ACCOUNT || '').trim();
  const amount = Number(amountStr);
  if (!Number.isFinite(amount)) return { ok: false };
  return { ok: idramId === env.idram.merchantId, billNo, amount };
}

// idram_result: confirmation branch — MD5(rec_account:amount:secret:bill_no:payer:trans_id:trans_date)
export function verifyChecksum(body) {
  const recAccount = body.EDP_REC_ACCOUNT || '';
  const amount = body.EDP_AMOUNT || '';
  const billNo = body.EDP_BILL_NO || '';
  const payer = body.EDP_PAYER_ACCOUNT || '';
  const transId = body.EDP_TRANS_ID || '';
  const transDate = body.EDP_TRANS_DATE || '';
  const checksum = (body.EDP_CHECKSUM || '').toUpperCase();
  const raw = `${recAccount}:${amount}:${env.idram.secretKey}:${billNo}:${payer}:${transId}:${transDate}`;
  const expected = crypto.createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
  return { ok: checksum === expected, billNo, transId };
}
