import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StorageTester } from './components/storage-tester';

export default async function CrewDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/signin');
  }

  const appMetadata = user.app_metadata || {};

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 text-orange-600">Crew Dashboard</h1>
      <p className="mb-8 text-gray-600">View your assigned jobs and submit completion reports.</p>
      
      <div className="bg-gray-100 p-4 rounded-md mb-8">
        <h2 className="font-semibold mb-2">Your Verified Claims:</h2>
        <pre className="text-sm bg-white p-4 rounded shadow-inner overflow-auto">
          {JSON.stringify(appMetadata, null, 2)}
        </pre>
      </div>

      <StorageTester />
    </div>
  );
}
