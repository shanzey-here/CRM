import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CrewJobsList } from './components/crew-jobs-list';

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
      <CrewJobsList />
    </div>
  );
}
