import { useAuth } from '../../../hooks/useAuth';

const PROFILE_ROLES = new Set(['sales_rep', 'sales_manager', 'finance_ops', 'finance']);

const ROLE_LABELS = {
  sales_rep: 'Sales Representative',
  sales_manager: 'Sales Manager',
  finance: 'Finance Manager',
  finance_ops: 'Finance Manager',
};

export default function ProfileCard() {
  const { user } = useAuth();

  if (!PROFILE_ROLES.has(user?.role)) return null;

  const initials = (user.full_name || 'User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section className="profile-card" aria-label="Profile">
      <div className="profile-avatar" aria-hidden="true">{initials}</div>
      <div className="profile-copy">
        <p className="eyebrow">Profile</p>
        <h2>{user.full_name || 'DealFlow user'}</h2>
        <p>{ROLE_LABELS[user.role] || user.role}</p>
        {user.email && <span>{user.email}</span>}
      </div>
    </section>
  );
}