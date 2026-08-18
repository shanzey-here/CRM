import { StorageTester } from '../components/storage-tester';
import { OfflineIndicator } from '../components/offline-indicator';

export default function CrewTestDashboard() {
  return (
    <div className="p-8 relative">
      <OfflineIndicator />
      <h1 className="text-3xl font-bold mb-4 text-orange-600">Crew Offline Test Page</h1>
      <p className="mb-8 text-gray-600">Public page specifically for testing PWA and IndexedDB.</p>
      
      <StorageTester />
    </div>
  );
}
