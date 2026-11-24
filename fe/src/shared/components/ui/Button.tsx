import React from 'react';
import { LoaderCircle } from 'lucide-react';
export function Button({
  children,
  variant = 'primary',
  busy = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={busy || props.disabled}
      className={`button button-${variant} ${props.className || ''}`}
    >
      {busy ? <LoaderCircle size={15} className="spinning" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
