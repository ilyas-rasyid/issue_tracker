import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={15} /> All issues
      </Link>
      <div className="auth-sheet">
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
export function ValidReturn(path: string | null) {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return '/';
  return path;
}
