import React, { Suspense } from 'react';
import MessagesWorkspace from '@/components/chat/MessagesWorkspace';

export default function MemberMessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 font-mono text-xs text-slate-400">
          CHARGEMENT DE LA MESSAGERIE...
        </div>
      }
    >
      <MessagesWorkspace />
    </Suspense>
  );
}
