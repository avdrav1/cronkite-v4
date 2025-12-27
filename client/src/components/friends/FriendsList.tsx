import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Users, User, MoreVertical, UserMinus, AlertCircle, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Friend {
  id: string;
  profile: {
    id: string;
    displayName: string;
    email: string;
    avatarUrl?: string;
  };
  friendshipId: string;
  confirmedAt: string;
}

interface FriendsResponse {
  success: boolean;
  friends: Friend[];
  total: number;
}

export function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [unfriendDialog, setUnfriendDialog] = useState<{ isOpen: boolean; friend: Friend | null }>({
    isOpen: false,
    friend: null,
  });
  const [isUnfriending, setIsUnfriending] = useState(false);
  const { toast } = useToast();

  const fetchFriends = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/friends');
      const data: FriendsResponse = await response.json();
      setFriends(data.friends);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load friends');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  const handleUnfriend = async (friend: Friend) => {
    setIsUnfriending(true);
    try {
      await apiRequest('DELETE', `/api/friends/${friend.profile.id}`);
      toast({
        title: "Friend removed",
        description: `You are no longer friends with ${friend.profile.displayName}`,
      });
      setFriends(prev => prev.filter(f => f.id !== friend.id));
      setUnfriendDialog({ isOpen: false, friend: null });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to remove friend",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsUnfriending(false);
    }
  };

  const filteredFriends = friends.filter(friend =>
    friend.profile.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    friend.profile.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Button variant="outline" size="sm" onClick={fetchFriends}>
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
        <h3 className="text-lg font-semibold">
          Friends ({friends.length})
        </h3>
        <Button variant="outline" size="sm" onClick={fetchFriends}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {friends.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search friends..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      {filteredFriends.length > 0 ? (
        <div className="space-y-3">
          {filteredFriends.map((friend) => (
            <Card key={friend.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={friend.profile.avatarUrl} alt={friend.profile.displayName} />
                      <AvatarFallback>
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{friend.profile.displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        Friends since {formatDistanceToNow(new Date(friend.confirmedAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setUnfriendDialog({ isOpen: true, friend })}
                        className="text-red-600 focus:text-red-600"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Remove Friend
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No friends yet</p>
          <p className="text-sm">Start by searching for people you know and sending friend requests</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No friends match your search</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      )}

      <AlertDialog open={unfriendDialog.isOpen} onOpenChange={(open) => 
        setUnfriendDialog({ isOpen: open, friend: unfriendDialog.friend })
      }>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {unfriendDialog.friend?.profile.displayName} as a friend? 
              This will remove them from your friends list and they won't be able to see your comments or tag you anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unfriendDialog.friend && handleUnfriend(unfriendDialog.friend)}
              disabled={isUnfriending}
              className="bg-red-600 hover:bg-red-700"
            >
              {isUnfriending ? "Removing..." : "Remove Friend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}