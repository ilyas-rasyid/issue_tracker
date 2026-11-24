import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput({
  className = '',
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);

  return (
    <div className="password-input-wrapper">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={className}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setShow((prev) => !prev)}
        aria-label={show ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

