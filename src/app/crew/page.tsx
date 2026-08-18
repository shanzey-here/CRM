import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { CrewJobsList } from './components/crew-jobs-list';

import { logout } from '@/app/login/actions';

export default async function CrewDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const appMetadata = user.app_metadata || {};

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-blue-600">Crew Dashboard</h1>
        <form action={logout}>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors">
            Log out
          </button>
        </form>
      </div>
      <CrewJobsList />
    </div>
  );
}
