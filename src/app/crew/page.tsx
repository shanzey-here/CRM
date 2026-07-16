import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CrewDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const appMetadata = user.app_metadata || {};

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4 text-orange-600">Crew Dashboard</h1>
      <p className="mb-8 text-gray-600">View your assigned jobs and submit completion reports.</p>
      
      <div className="bg-gray-100 p-4 rounded-md">
        <h2 className="font-semibold mb-2">Your Verified Claims:</h2>
        <pre className="text-sm bg-white p-4 rounded shadow-inner">
          {JSON.stringify(appMetadata, null, 2)}
        </pre>
      </div>
    </div>
  );
}
