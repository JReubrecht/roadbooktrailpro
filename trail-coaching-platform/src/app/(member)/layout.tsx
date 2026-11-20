import type { Metadata } from 'next';
import React from 'react';
import MemberShell from '@/components/layout/MemberShell';

export const metadata: Metadata = {
  title: 'Espace Membre',
  robots: {
    index: false,
    follow: false,
  },
};

export default function MemberGroupLayout({ children }: { children: React.ReactNode }) {
  return <MemberShell>{children}</MemberShell>;
}
