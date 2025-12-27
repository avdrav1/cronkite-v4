import { useState, useEffect, useCallback } from "react";
import { Search, User, UserPlus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Simple debounce implementation
function debounce<T extends (...args: any[]) => any>(func: T, delay: number): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout;
  const debounced = ((...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  }) as T & { cancel: () => void };
  
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
}

interface SearchUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  canSendRequest: boolean;
  relationshipStatus?: "none" | "pending_sent" | "pending_received" | "friends" | "blocked";
}

interface UserSearchResponse {
  success: boolean;
  users: SearchUser[];
  total: number;
}

export function UserSearch() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setIsSearching(true);
      setError(null);
      const response = await apiRequest('GET', `/api/users/discover?q=${encodeURIComponent(query)}`);
      const data: UserSearchResponse = await response.json();
      setSearchResults(data.users);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to search users');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce search to avoid too many API calls
  const debouncedSearch = useCallback(
    debounce((query: string) => performSearch(query), 300),
    []
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  const handleSendFriendRequest = async (userId: string, displayName: string) => {
    setSendingRequests(prev => new Set(prev).add(userId));
    try {
      await apiRequest('POST', '/api/friends/request', { toUserId: userId });
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${displayName}`,
      });
      
      // Update the user's status in search results
      setSearchResults(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, relationshipStatus: "pending_sent", canSendRequest: false }
            : user
        )
      );
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send friend request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setSendingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getRelationshipStatusText = (status?: string) => {
    switch (status) {
      case "friends":
        return "Friends";
      case "pending_sent":
        return "Request sent";
      case "pending_received":
        return "Request received";
      case "blocked":
        return "Blocked";
      default:
        return null;
    }
  };

  const getRelationshipStatusColor = (status?: string) => {
    switch (status) {
      case "friends":
        return "text-green-600";
      case "pending_sent":
        return "text-amber-600";
      case "pending_received":
        return "text-blue-600";
      case "blocked":
        return "text-red-600";
      default:
        return "";
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">Find Friends</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Search for people by their display name or email address
        </p>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {searchQuery.trim() && !isSearching && searchResults.length === 0 && !error && (
        <div className="text-center py-8 text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No users found</p>
          <p className="text-sm">Try searching with a different name or email</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-3">
          {searchResults.map((user) => {
            const isLoading = sendingRequests.has(user.id);
            const statusText = getRelationshipStatusText(user.relationshipStatus);
            const statusColor = getRelationshipStatusColor(user.relationshipStatus);

            return (
              <Card key={user.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.avatarUrl} alt={user.displayName} />
                        <AvatarFallback>
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-sm text-muted-foreground">{user.email}</p>
                        {statusText && (
                          <p className={`text-sm font-medium ${statusColor}`}>
                            {statusText}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {user.canSendRequest && user.relationshipStatus === "none" && (
                      <Button
                        size="sm"
                        onClick={() => handleSendFriendRequest(user.id, user.displayName)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4 mr-2" />
                        )}
                        {isLoading ? "Sending..." : "Add Friend"}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}