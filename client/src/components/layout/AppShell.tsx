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
import { useAuth } from "@/contexts/AuthContext";

import { AddFeedModal } from "@/components/feed/AddFeedModal";
import { FeedsList } from "@/components/layout/FeedsList";
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
  const { user, logout } = useAuth();

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
        <div className="flex flex-col items-center justify-center py-6 gap-6 relative">
          <Link href="/" className="flex flex-col items-center gap-2 group">
            <span className="font-masthead font-bold text-6xl md:text-8xl tracking-tight leading-none text-foreground text-center">
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

          {/* Left side controls */}
          <div className="absolute top-6 left-4 md:left-8 flex items-center gap-1">
            {/* Hamburger Menu - Toggles BOTH panels */}
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
            {/* Left Panel Toggle */}
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

          {/* Right side controls */}
          <div className="absolute top-6 right-4 md:right-8 flex items-center gap-2">
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
                <DropdownMenuItem asChild>
                  <Link href="/admin" className="w-full cursor-pointer">
                    <Shield className="mr-2 h-4 w-4" />
                    Feed Admin
                  </Link>
                </DropdownMenuItem>
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
            <Button 
              className="w-full justify-start gap-2 shadow-sm font-medium shrink-0" 
              size="lg"
              onClick={() => setIsAddFeedOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add New Feed
            </Button>
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
    </div>
  );
}
