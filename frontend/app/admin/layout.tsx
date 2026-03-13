import { Navbar } from '@/components/Navbar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
