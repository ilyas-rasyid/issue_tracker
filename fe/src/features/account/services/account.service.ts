import { get, mutate } from '../../../shared/api/index';
export interface PublicProfileDetails {
  displayName: string | null;
  bio: string | null;
  githubUrl: string | null;
}
export function fetchAccountProfile(username: string) {
  return get<PublicProfileDetails>(`/users/${encodeURIComponent(username)}`);
}
export function updateProfile(data: Partial<PublicProfileDetails>) {
  return mutate('/account/profile', 'PATCH', data);
}
export function uploadAccountAvatar(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return mutate('/account/avatar', 'PUT', formData);
}
export function removeAccountAvatar() {
  return mutate('/account/avatar', 'DELETE');
}
export function updatePassword(currentPassword: string, newPassword: string) {
  return mutate('/account/change-password', 'POST', {
    currentPassword,
    newPassword,
  });
}
export function requestEmailChange(newEmail: string, password: string) {
  return mutate('/account/change-email', 'POST', {
    newEmail,
    password,
  });
}
export function deleteAccount(password: string, confirmation: string) {
  return mutate('/account', 'DELETE', {
    password,
    confirmation,
  });
}
