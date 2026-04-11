'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WaitingPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="animate-spin w-8 h-8 border-3 border-orange border-t-transparent rounded-full" />
    </div>
  );
}
