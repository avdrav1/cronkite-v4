import React, { useState, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Settings,
  Menu,
  Plus,
  LogOut,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Shield,
  Activity,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";

import { AddFeedModal } from "@/components/feed/AddFeedModal";
import { FeedsList } from "@/components/layout/FeedsList";
import { useFeedCountQuery } from "@/hooks/useFeedsQuery";
import { TrendingClusters } from "@/components/trending/TrendingClusters";
import { SemanticSearch } from "@/components/search/SemanticSearch";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, newArticles: 0 });
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const { data: feedCount } = useFeedCountQuery();
  const isFeedsFull = feedCount?.remaining === 0;

  const handleSyncAll = async () => {
    try {
      // Fetch user's feeds
      const feedsResponse = await apiRequest('GET', '/api/feeds/user');
      const feedsData = await feedsResponse.json();
      const feeds = feedsData.feeds?.filter((f: any) => f.status === 'active') || [];

      if (feeds.length === 0) {
        toast({ title: "No feeds to sync" });
        return;
      }

      setIsSyncing(true);
      setSyncProgress({ current: 0, total: feeds.length, newArticles: 0 });

      let totalNew = 0;
      for (let i = 0; i < feeds.length; i++) {
        setSyncProgress(p => ({ ...p, current: i + 1 }));
        try {
          const res = await apiRequest('POST', '/api/feeds/sync', { feedIds: [feeds[i].id] });
          const result = await res.json();
          if (result.results?.[0]) {
            totalNew += result.results[0].articlesNew || 0;
            setSyncProgress(p => ({ ...p, newArticles: totalNew }));
          }
        } catch (e) {
          console.error('Feed sync error:', e);
        }
      }

      toast({
        title: "Sync Complete",
        description: `Found ${totalNew} new article${totalNew !== 1 ? 's' : ''}.`
      });

      // Trigger feed list refresh
      window.dispatchEvent(new CustomEvent('feedsUpdated'));
    } catch (e) {
      console.error('Sync all error:', e);
      toast({ variant: "destructive", title: "Sync failed" });
    } finally {
      setIsSyncing(false);
      setSyncProgress({ current: 0, total: 0, newArticles: 0 });
    }
  };

  const { cluster } = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return { cluster: params.get('cluster') };
  }, [searchString]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md shrink-0 z-50">
        {/* Mobile Header */}
        <div className="flex md:hidden flex-col">
          <div className="flex items-center justify-between p-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileNavOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <Link href="/" className="flex flex-col items-center">
              <span className="font-masthead font-bold text-2xl tracking-tight leading-none text-foreground">
                Cronkite
              </span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url || undefined} alt={user?.display_name} />
                    <AvatarFallback>{user?.display_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.display_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="w-full cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {user?.is_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="w-full cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Feed Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="px-3 pb-3">
            <SemanticSearch
              placeholder="Search..."
              onArticleClick={(articleId) => setLocation(`/?article=${articleId}`)}
            />
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex flex-col items-center justify-center py-6 gap-6 relative">
          <Link href="/" className="flex flex-col items-center gap-2 group">
            <span className="font-masthead font-bold text-8xl tracking-tight leading-none text-foreground text-center">
              Cronkite
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              And that's the way it is • {format(new Date(), "MMMM d, yyyy")}
            </span>
          </Link>

          <div className="w-full max-w-xl mx-auto px-4">
            <SemanticSearch
              placeholder="Search articles, feeds, or topics..."
              onArticleClick={(articleId) => setLocation(`/?article=${articleId}`)}
            />
          </div>

          {/* Left side controls - Desktop only */}
          <div className="absolute top-6 left-8 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const newState = !(isLeftSidebarOpen && isRightSidebarOpen);
                setIsLeftSidebarOpen(newState);
                setIsRightSidebarOpen(newState);
              }}
              title={isLeftSidebarOpen && isRightSidebarOpen ? "Hide panels" : "Show panels"}
            >
              <Menu className="h-6 w-6" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
              title={isLeftSidebarOpen ? "Hide feeds" : "Show feeds"}
            >
              {isLeftSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
            </Button>
          </div>

          {/* Right side controls - Desktop only */}
          <div className="absolute top-6 right-8 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
              title={isRightSidebarOpen ? "Hide trending" : "Show trending"}
            >
              {isRightSidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
            </Button>
            <Link href="/onboarding">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Sparkles className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full overflow-hidden border border-transparent hover:border-border">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url || undefined} alt={user?.display_name} />
                    <AvatarFallback>{user?.display_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.display_name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="w-full cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {user?.is_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="w-full cursor-pointer">
                      <Shield className="mr-2 h-4 w-4" />
                      Feed Admin
                    </Link>
                  </DropdownMenuItem>
                )}
                {user?.is_admin && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/sync-monitor" className="w-full cursor-pointer">
                      <Activity className="mr-2 h-4 w-4" />
                      Sync Monitor
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Feeds */}
        <aside
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-sidebar w-64 shrink-0 transition-all duration-300 ease-out",
            !isLeftSidebarOpen && "w-0 border-none"
          )}
        >
          <div className={cn(
            "flex flex-col p-4 gap-6 h-full overflow-y-auto scrollbar-none",
            !isLeftSidebarOpen && "p-0 opacity-0"
          )}>
            {isFeedsFull ? (
              <Button
                variant="destructive"
                className="w-full justify-start gap-2 shadow-sm font-medium shrink-0"
                size="lg"
                onClick={() => setLocation('/settings')}
              >
                <Trash2 className="h-4 w-4" /> Delete Feed
              </Button>
            ) : (
              <Button
                className="w-full justify-start gap-2 shadow-sm font-medium shrink-0"
                size="lg"
                onClick={() => setIsAddFeedOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add New Feed
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full justify-start gap-2 font-medium shrink-0"
              size="lg"
              onClick={handleSyncAll}
              disabled={isSyncing}
            >
              <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
              {isSyncing ? `Syncing ${syncProgress.current}/${syncProgress.total}...` : 'Sync All Feeds'}
            </Button>
            {isSyncing && (
              <div className="space-y-1">
                <Progress value={(syncProgress.current / syncProgress.total) * 100} className="h-2" />
                <p className="text-xs text-muted-foreground text-center">{syncProgress.newArticles} new articles</p>
              </div>
            )}
            <FeedsList />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto scrollbar-none bg-background/50">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>

        {/* Right Sidebar - Trending */}
        <aside
          className={cn(
            "hidden md:flex flex-col border-l border-border bg-sidebar w-72 shrink-0 transition-all duration-300 ease-out overflow-hidden",
            !isRightSidebarOpen && "w-0 border-none"
          )}
        >
          <div className={cn(
            "flex flex-col p-4 gap-6 h-full overflow-y-auto scrollbar-none w-72",
            !isRightSidebarOpen && "p-0 opacity-0"
          )}>
            <TrendingClusters 
              onClusterClick={(clickedCluster) => {
                console.log('🔥 Cluster clicked:', clickedCluster.id, clickedCluster.topic);
                // Dispatch event to open the TrendingClusterSheet in Home.tsx
                window.dispatchEvent(new CustomEvent('openTrendingCluster', { detail: clickedCluster }));
              }}
              activeClusterId={cluster || undefined}
            />
          </div>
        </aside>
      </div>

      <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />

      {/* Mobile Navigation Sheet */}
      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent side="left" className="w-80 p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="font-masthead text-xl">Cronkite</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full overflow-y-auto">
            {/* Action Buttons */}
            <div className="p-4 space-y-2 border-b">
              {isFeedsFull ? (
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-2"
                  onClick={() => { setIsMobileNavOpen(false); setLocation('/settings'); }}
                >
                  <Trash2 className="h-4 w-4" /> Delete Feed
                </Button>
              ) : (
                <Button
                  className="w-full justify-start gap-2"
                  onClick={() => { setIsMobileNavOpen(false); setIsAddFeedOpen(true); }}
                >
                  <Plus className="h-4 w-4" /> Add New Feed
                </Button>
              )}
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => { setIsMobileNavOpen(false); handleSyncAll(); }}
                disabled={isSyncing}
              >
                <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                {isSyncing ? `Syncing...` : 'Sync All Feeds'}
              </Button>
            </div>

            {/* Feeds List */}
            <div className="flex-1 overflow-y-auto p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Your Feeds</h3>
              <FeedsList onFeedSelect={() => setIsMobileNavOpen(false)} />
            </div>

            <Separator />

            {/* Trending */}
            <div className="p-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">Trending</h3>
              <TrendingClusters
                onClusterClick={(clickedCluster) => {
                  setIsMobileNavOpen(false);
                  window.dispatchEvent(new CustomEvent('openTrendingCluster', { detail: clickedCluster }));
                }}
                activeClusterId={cluster || undefined}
              />
            </div>

            <Separator />

            {/* Navigation Links */}
            <div className="p-4 space-y-1">
              <Link href="/settings" onClick={() => setIsMobileNavOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" /> Settings
                </Button>
              </Link>
              <Link href="/onboarding" onClick={() => setIsMobileNavOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Sparkles className="h-4 w-4" /> Customize Feeds
                </Button>
              </Link>
              {user?.is_admin && (
                <Link href="/admin" onClick={() => setIsMobileNavOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <Shield className="h-4 w-4" /> Feed Admin
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
