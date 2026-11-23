import nodemailer from 'nodemailer';
export const mailer = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: Number(process.env.SMTP_PORT || 1025),
  secure: false,
});
export async function sendMail(to: string, subject: string, link: string) {
  await mailer.sendMail({
    from: process.env.MAIL_FROM || 'IssueTrack <noreply@localhost.test>',
    to,
    subject,
    text: `${subject}\n\nOpen this link to continue:\n${link}\n\nIf you did not request this, ignore this message.`,
  });
}
