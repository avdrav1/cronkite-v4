import { useState, useEffect, useMemo } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import {
  Settings,
  Rss,
  Clock,
  Mail,
  Sparkles,
  User,
  Users,
  ChevronRight,
  ChevronLeft,
  Plus,
  Search,
  Shield,
  Download,
  Flag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { FeedManagement } from "@/components/settings/FeedManagement";
import { AIUsageSettings } from "@/components/settings/AIUsageSettings";
import { ScheduleSettings } from "@/components/settings/ScheduleSettings";
import { DataExportSettings } from "@/components/settings/DataExportSettings";
import { ReportingSettings } from "@/components/settings/ReportingSettings";
import { FriendManagement } from "@/components/friends/FriendManagement";
import { Link, useLocation, useSearch } from "wouter";

const SETTINGS_TABS = [
  { id: 'feeds', label: 'Feeds', icon: Rss },
  { id: 'appearance', label: 'Appearance', icon: Sparkles },
  { id: 'schedule', label: 'Schedule', icon: Clock },
  { id: 'digest', label: 'Digest', icon: Mail },
  { id: 'ai', label: 'AI', icon: Sparkles },
  { id: 'account', label: 'Account', icon: User },
  { id: 'friends', label: 'Friends', icon: Users },
  { id: 'privacy', label: 'Privacy & Data', icon: Shield },
  { id: 'safety', label: 'Safety & Reporting', icon: Flag },
];

export default function SettingsPage() {
  const [location, setLocation] = useLocation();
  const searchString = useSearch();
  
  // Parse URL params to get the tab parameter
  const urlTabParam = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get('tab');
  }, [searchString]);
  
  // Initialize activeTab based on URL parameter or default to 'feeds'
  const [activeTab, setActiveTab] = useState(() => {
    const validTabs = SETTINGS_TABS.map(tab => tab.id);
    return urlTabParam && validTabs.includes(urlTabParam) ? urlTabParam : 'feeds';
  });
  
  // Update activeTab when URL changes
  useEffect(() => {
    const validTabs = SETTINGS_TABS.map(tab => tab.id);
    if (urlTabParam && validTabs.includes(urlTabParam)) {
      setActiveTab(urlTabParam);
    } else if (urlTabParam === null) {
      // No tab parameter in URL, keep current tab or default to feeds
      setActiveTab(prev => prev || 'feeds');
    }
    // If urlTabParam is invalid, we keep the current activeTab
  }, [urlTabParam]);
  
  // Optional: Update URL when tab changes (enhancement)
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    
    // Update URL with new tab parameter
    const params = new URLSearchParams(searchString);
    params.set('tab', tabId);
    setLocation(`/settings?${params.toString()}`);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'feeds':
        return <FeedManagement />;
      case 'appearance':
        return <AppearanceSettings />;
      case 'schedule':
        return <ScheduleSettings />;
      case 'digest':
        return <div className="p-8 text-muted-foreground">Digest settings coming soon...</div>;
      case 'ai':
        return <AIUsageSettings />;
      case 'account':
        return <div className="p-8 text-muted-foreground">Account settings coming soon...</div>;
      case 'friends':
        return <FriendManagement />;
      case 'privacy':
        return <DataExportSettings />;
      case 'safety':
        return <ReportingSettings />;
      default:
        return <FeedManagement />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50 px-4 md:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-4 w-4" /> Back to Reader
            </Button>
          </Link>
          <div className="h-6 w-px bg-border mx-2" />
          <h1 className="font-display font-bold text-lg">Settings</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border border-transparent hover:border-border">
             <User className="h-5 w-5" />
           </Button>
        </div>
      </header>

      <div className="flex flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-8 gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-64 hidden md:flex flex-col gap-2 shrink-0">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-left",
                  isActive 
                    ? "bg-primary/10 text-primary font-bold shadow-sm" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {tab.label}
                {isActive && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </aside>

        {/* Content Area */}
        <main className="flex-1 bg-card border border-border rounded-2xl shadow-sm min-h-[600px]">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
