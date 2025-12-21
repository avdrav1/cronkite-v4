import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Search,
  Settings,
  Menu,
  Plus,
  LayoutGrid,
  Star,
  Clock,
  Sparkles,
  LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
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

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [location] = useLocation();
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      // Logout will trigger a redirect to /auth via the AuthContext
    } catch (error) {
      console.error('Logout failed:', error);
      // Could show a toast notification here
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex flex-col items-center justify-center py-6 gap-6 relative">
          
          {/* Logo */}
          <Link href="/" className="flex flex-col items-center gap-2 group">
            <span className="font-masthead font-bold text-6xl md:text-8xl tracking-tight leading-none text-foreground text-center">
              Cronkite
            </span>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-medium">
              And that's the way it is • {format(new Date(), "MMMM d, yyyy")}
            </span>
          </Link>

          {/* Search Bar */}
          <div className="w-full max-w-xl mx-auto px-4 relative group">
             <Search className="absolute left-7 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
             <Input
               placeholder="Search articles, feeds, or topics..."
               className="pl-10 h-11 bg-muted/50 border-transparent focus:bg-background focus:border-primary/20 transition-all rounded-full shadow-sm hover:bg-muted/80 w-full"
             />
          </div>

          {/* Sidebar Toggle - Absolute Left */}
          <div className="absolute top-6 left-4 md:left-8">
             <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
             >
               <Menu className="h-6 w-6" />
             </Button>
          </div>

          {/* User Actions - Absolute Right */}
          <div className="absolute top-6 right-4 md:right-8 flex items-center gap-2">
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
                    <AvatarFallback>
                      {user?.display_name?.charAt(0).toUpperCase() || 'U'}
                    </AvatarFallback>
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
        {/* Sidebar - Desktop */}
        <aside
          className={cn(
            "hidden md:flex flex-col border-r border-border bg-sidebar w-64 transition-all duration-300 ease-out p-4 gap-6 overflow-y-auto",
            !isSidebarOpen && "w-0 p-0 overflow-hidden opacity-0 border-none"
          )}
        >
          <Button 
            className="w-full justify-start gap-2 shadow-sm font-medium" 
            size="lg"
            onClick={() => setIsAddFeedOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add New Feed
          </Button>

          <nav className="flex flex-col gap-1">
            <NavItem icon={LayoutGrid} label="All Articles" active={location === "/" && !window.location.search} />
            <NavItem icon={Clock} label="Unread" />
            <NavItem icon={Star} label="Starred" />
            <Link href="/onboarding" className="w-full">
              <NavItem icon={Sparkles} label="Onboarding (Dev)" />
            </Link>
            <Link href="/settings" className="w-full">
              <NavItem icon={Settings} label="Settings" />
            </Link>
          </nav>

          <FeedsList />
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative bg-background/50">
          <div className="max-w-[1600px] mx-auto p-4 md:p-8">
            {children}
          </div>
        </main>
      </div>

      <AddFeedModal isOpen={isAddFeedOpen} onClose={() => setIsAddFeedOpen(false)} />
    </div>
  );
}

function NavItem({ icon: Icon, label, count, active }: { icon: any; label: string; count?: number; active?: boolean }) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    if (label === "All Articles") {
      // Clear filters by navigating to root without query parameters
      // Requirements: 4.2 - Clear any feed/category filters when navigating to "All Articles"
      setLocation("/", { replace: true });
    }
  };

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      className={cn(
        "w-full justify-start gap-3 px-3 h-10 font-medium transition-all hover:translate-x-1",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
          {count}
        </span>
      )}
    </Button>
  );
}
