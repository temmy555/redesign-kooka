type BookingEmailLanguage = "id" | "en";

type BookingStatusEmailKind = "PAYMENT_RECORDED" | "BOOKING_CONFIRMED";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function publicUrl(path: string) {
  const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/u,
    "",
  );
  return `${baseUrl}${path}`;
}

export function buildBookingStatusEmail(input: {
  kind: BookingStatusEmailKind;
  language: BookingEmailLanguage;
  bookingCode: string;
}) {
  const isEnglish = input.language === "en";
  const recorded = input.kind === "PAYMENT_RECORDED";
  const subject = recorded
    ? isEnglish
      ? `Payment is being reviewed ${input.bookingCode}`
      : `Pembayaran sedang diverifikasi ${input.bookingCode}`
    : isEnglish
      ? `Booking confirmed ${input.bookingCode}`
      : `Booking terkonfirmasi ${input.bookingCode}`;
  const text = recorded
    ? isEnglish
      ? `We recorded payment evidence for booking ${input.bookingCode}. Your room inventory remains held while Front Office verifies it.`
      : `Bukti pembayaran untuk booking ${input.bookingCode} telah dicatat. Inventori kamar tetap ditahan selama Front Office melakukan verifikasi.`
    : isEnglish
      ? `Payment has been verified and booking ${input.bookingCode} is confirmed.`
      : `Pembayaran telah diverifikasi dan booking ${input.bookingCode} telah terkonfirmasi.`;
  const eyebrow = recorded
    ? isEnglish
      ? "PAYMENT RECEIVED"
      : "BUKTI PEMBAYARAN DITERIMA"
    : isEnglish
      ? "BOOKING CONFIRMED"
      : "BOOKING TERKONFIRMASI";
  const title = recorded
    ? isEnglish
      ? "We are reviewing your payment."
      : "Pembayaran Anda sedang kami periksa."
    : isEnglish
      ? "Your stay is confirmed."
      : "Pemesanan Anda telah terkonfirmasi.";
  const detail = recorded
    ? isEnglish
      ? "Your selected room inventory remains reserved during Front Office verification. No further action is required unless our team contacts you."
      : "Kamar yang Anda pilih tetap kami tahan selama proses verifikasi Front Office. Tidak ada tindakan lain yang diperlukan kecuali tim kami menghubungi Anda."
    : isEnglish
      ? "Thank you for choosing KOOKA Residence Surabaya. We look forward to welcoming you."
      : "Terima kasih telah memilih KOOKA Residence Surabaya. Kami menantikan kedatangan Anda.";
  const button = isEnglish ? "View booking" : "Lihat booking";
  const help = isEnglish
    ? "Need assistance? Please contact our Front Office."
    : "Butuh bantuan? Silakan hubungi Front Office kami.";
  const bookingUrl = publicUrl(
    `/booking/lookup?code=${encodeURIComponent(input.bookingCode)}`,
  );
  const logoUrl = publicUrl("/images/kooka-logo-official.png");

  return {
    subject,
    text,
    html: `<!doctype html>
<html lang="${isEnglish ? "en" : "id"}">
  <body style="margin:0;background:#f3efe7;color:#153f35;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fffdf8;border:1px solid #d9ded7;">
            <tr>
              <td style="background:#103c32;padding:24px 32px;">
                <img src="${escapeHtml(logoUrl)}" width="154" alt="KOOKA Residence" style="display:block;width:154px;max-width:100%;height:auto;background:#fffdf8;border-radius:5px;padding:6px 10px;" />
              </td>
            </tr>
            <tr>
              <td style="padding:42px 36px 16px;">
                <div style="color:#b85e41;font-size:12px;font-weight:700;letter-spacing:2px;line-height:1.5;">${escapeHtml(eyebrow)}</div>
                <h1 style="margin:14px 0 18px;color:#153f35;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.15;font-weight:400;">${escapeHtml(title)}</h1>
                <p style="margin:0;color:#536d66;font-size:16px;line-height:1.7;">${escapeHtml(text)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 36px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#edf1e9;border-left:4px solid #628269;">
                  <tr>
                    <td style="padding:20px 22px;">
                      <div style="color:#75857e;font-size:11px;font-weight:700;letter-spacing:1.6px;">BOOKING CODE</div>
                      <div style="margin-top:7px;color:#153f35;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;word-break:break-word;">${escapeHtml(input.bookingCode)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 36px 38px;">
                <p style="margin:0 0 24px;color:#536d66;font-size:15px;line-height:1.7;">${escapeHtml(detail)}</p>
                <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;background:#153f35;color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1.2px;padding:15px 24px;">${escapeHtml(button.toUpperCase())}</a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #d9ded7;padding:22px 36px 28px;color:#73817c;font-size:12px;line-height:1.6;">
                ${escapeHtml(help)}<br />KOOKA Residence Surabaya · Darmo Permai Selatan XVI / 28, Surabaya
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
