import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserProfileCard from '@/components/auth/UserProfileCard';
import Link from 'next/link';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-6 text-center text-3xl font-bold sm:mb-8">
            Your Profile
          </h1>

          <UserProfileCard className="mb-6" />

          <div className="flex justify-center gap-4">
            <Link href="/account" className="btn btn-primary min-h-11">
              Account Settings
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
