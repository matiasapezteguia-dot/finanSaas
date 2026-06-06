import Sidebar from "../../components/Sidebar";
import { AppProviders } from "../../components/Providers";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppProviders>
      <div className="min-h-full flex">
        <Sidebar />
        <main className="flex-1 bg-slate-50">
          {children}
        </main>
      </div>
    </AppProviders>
  );
}