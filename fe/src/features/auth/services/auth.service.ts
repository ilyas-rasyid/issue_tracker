import { mutate } from '../../../shared/api/index';

export function loginUser(payload: { email: string; password: string }) {
  return mutate<{ user: any }>('/auth/login', 'POST', payload);
}

export function registerUser(payload: {
  username: string;
  displayName: string;
  email: string;
  password: string;
}) {
  return mutate<{ user: any; authenticated: boolean; nextAction: string; mailSent: boolean }>(
    '/auth/register',
    'POST',
    payload,
  );
}

export function logoutUser() {
  return mutate<void>('/auth/logout', 'POST');
}

export function requestPasswordReset(email: string) {
  return mutate<{ message: string }>('/auth/forgot-password', 'POST', { email });
}

export function resetPassword(token: string, newPassword: string) {
  return mutate<{ message: string }>('/auth/reset-password', 'POST', { token, newPassword });
}

export function verifyEmail(token: string, isChangeMode = false) {
  const endpoint = isChangeMode ? '/account/verify-email' : '/auth/verify-email';
  return mutate<{ verified?: boolean; message?: string }>(endpoint, 'POST', { token });
}

export function resendVerificationEmail() {
  return mutate<{ message: string; mailSent: boolean }>('/auth/resend-verification', 'POST');
}
