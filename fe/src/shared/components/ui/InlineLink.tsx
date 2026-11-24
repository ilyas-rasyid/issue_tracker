import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
export function InlineLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link className="inline-link" to={to}>
      {children}
      <ArrowRight size={13} />
    </Link>
  );
}
