import { useState, useEffect } from "react";
import { Users, User, UserPlus, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SuggestedUser {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  mutualFriendsCount: number;
  mutualFriends: Array<{
    id: string;
    displayName: string;
  }>;
  canSendRequest: boolean;
}

interface UserDiscoveryResponse {
  success: boolean;
  suggestions: SuggestedUser[];
  total: number;
}

export function UserDiscovery() {
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingRequests, setSendingRequests] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const fetchSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/users/discover?suggestions=true');
      const data: UserDiscoveryResponse = await response.json();
      setSuggestions(data.suggestions);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load friend suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const handleSendFriendRequest = async (userId: string, displayName: string) => {
    setSendingRequests(prev => new Set(prev).add(userId));
    try {
      await apiRequest('POST', '/api/friends/request', { toUserId: userId });
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${displayName}`,
      });
      
      // Remove the user from suggestions since we've sent a request
      setSuggestions(prev => prev.filter(user => user.id !== userId));
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={fetchSuggestions}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">People You May Know</h3>
          <p className="text-sm text-muted-foreground">
            Based on mutual connections and shared interests
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSuggestions}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-3">
          {suggestions.map((user) => {
            const isLoading = sendingRequests.has(user.id);

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
                      <div className="flex-1">
                        <p className="font-medium">{user.displayName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {user.mutualFriendsCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {user.mutualFriendsCount} mutual friend{user.mutualFriendsCount !== 1 ? 's' : ''}
                            </Badge>
                          )}
                        </div>
                        {user.mutualFriends.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Friends with {user.mutualFriends.slice(0, 2).map(f => f.displayName).join(', ')}
                            {user.mutualFriends.length > 2 && ` and ${user.mutualFriends.length - 2} other${user.mutualFriends.length > 3 ? 's' : ''}`}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {user.canSendRequest && (
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
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No friend suggestions available</p>
          <p className="text-sm">
            As you connect with more friends, we'll suggest people you might know
          </p>
        </div>
      )}
    </div>
  );
}