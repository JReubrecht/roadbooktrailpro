import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Connexion Espace Membre',
  description: 'Accédez à votre suivi physiologique, vos check-ins et vos roadbooks.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
