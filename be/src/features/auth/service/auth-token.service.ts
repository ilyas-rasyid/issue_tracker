import { prisma } from '../../../infrastructure/database/prisma';
import { AUTH_TOKEN_PURPOSE } from '../../../commons/constants/domain.constants';
import { randomToken, sha256 } from '../../../commons/security/crypto';
import { sendMail } from '../../../infrastructure/email/mailer';
export const issueToken = async (userId: string, purpose: string, pendingEmail?: string) => {
  const token = randomToken();
  await prisma.authToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      purpose,
      pendingEmail,
      expiresAt: new Date(
        Date.now() + (purpose === AUTH_TOKEN_PURPOSE.PASSWORD_RESET ? 30 * 60000 : 24 * 3600000),
      ),
    },
  });
  return token;
};
export const deliver = async (email: string, subject: string, url: string) => {
  try {
    await sendMail(email, subject, url);
    return true;
  } catch (e) {
    console.error('Mail delivery failed', String(e));
    return false;
  }
};
