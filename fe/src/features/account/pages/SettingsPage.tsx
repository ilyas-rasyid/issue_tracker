import { useState } from 'react';
import { ProfileSettings } from '../components/ProfileSettings';
import { SecuritySettings } from '../components/SecuritySettings';
import { DeleteAccountSettings } from '../components/DeleteAccountSettings';
type SettingsSection = 'profile' | 'security' | 'danger';
const settingsSections: {
  key: SettingsSection;
  label: string;
}[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'security', label: 'Security' },
  { key: 'danger', label: 'Delete account' },
];
/** Settings page only selects a section. Each section owns its form and API behavior. */
export function Settings() {
  const [section, setSection] = useState<SettingsSection>('profile');
  return (
    <main className="page settings-page">
      <div className="page-heading">
        <div>
          <h1>Settings</h1>
          <p>Manage your public profile and account security.</p>
        </div>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {settingsSections.map(({ key, label }) => (
            <button
              type="button"
              key={key}
              className={section === key ? 'active' : ''}
              aria-current={section === key ? 'page' : undefined}
              onClick={() => setSection(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="settings-main">
          {section === 'profile' && <ProfileSettings />}
          {section === 'security' && <SecuritySettings />}
          {section === 'danger' && <DeleteAccountSettings />}
        </div>
      </div>
    </main>
  );
}
