import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function SuperAdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // The proxy.ts middleware already ensures that only users with is_super_admin=true can get here,
  // but it's good practice to display the claims for verification.
  const appMetadata = user.app_metadata || {};

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 text-purple-600">Super Admin Dashboard</h1>
      <p className="mb-8 text-gray-600">Platform-wide management and global settings.</p>
      
      <div className="bg-gray-100 p-4 rounded-md">
        <h2 className="font-semibold mb-2">Your Verified Claims:</h2>
        <pre className="text-sm bg-white p-4 rounded shadow-inner">
          {JSON.stringify(appMetadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}
