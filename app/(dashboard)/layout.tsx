import { ThemeProvider } from "@/components/theme-provider";
import { WebSocketProvider } from "@/lib/websocket";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <WebSocketProvider>
        <div className="flex h-screen overflow-hidden bg-background">
          <AppSidebar />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </WebSocketProvider>
    </ThemeProvider>
  );
}
