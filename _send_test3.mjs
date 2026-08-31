// Temp script — verifikasi API key Resend baru setelah rotasi (lihat apicredential.md §7).
// Pakai: node --env-file=.env.local _send_test3.mjs
// (opsional) tentukan penerima: $env:TEST_TO="email@kantor.id"; node --env-file=.env.local _send_test3.mjs
import { sendEmail } from './lib/email.js';

const to = process.env.TEST_TO || 'hikenautomation@gmail.com';
const res = await sendEmail({
  to,
  subject: 'Macha App — test kirim pasca rotasi API key Resend',
  html: '<p>Jika kamu menerima email ini, key Resend yang baru berfungsi.</p>',
  text: 'Jika kamu menerima email ini, key Resend yang baru berfungsi.',
});

console.log(JSON.stringify({ to, hasKey: !!process.env.EMAIL_API_KEY, res: res ?? null }, null, 2));
if (!res || !res.id) process.exit(1);