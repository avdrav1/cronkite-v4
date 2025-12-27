import { useState, useEffect } from "react";
import { User, UserPlus, UserMinus, UserCheck, Clock, Shield, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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

interface UserProfileData {
  id: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  relationshipStatus: "none" | "pending_sent" | "pending_received" | "friends" | "blocked";
  canSendRequest: boolean;
  mutualFriendsCount?: number;
  mutualFriends?: Array<{
    id: string;
    displayName: string;
  }>;
  friendshipId?: string;
  confirmedAt?: string;
}

interface UserProfileProps {
  userId: string;
  onClose?: () => void;
}

export function UserProfile({ userId, onClose }: UserProfileProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showUnfriendDialog, setShowUnfriendDialog] = useState(false);
  const { toast } = useToast();

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', `/api/users/${userId}/profile`);
      const data = await response.json();
      setProfile(data.profile);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const handleSendFriendRequest = async () => {
    if (!profile) return;
    
    setActionLoading(true);
    try {
      await apiRequest('POST', '/api/friends/request', { toUserId: profile.id });
      toast({
        title: "Friend request sent",
        description: `Friend request sent to ${profile.displayName}`,
      });
      setProfile(prev => prev ? { ...prev, relationshipStatus: "pending_sent", canSendRequest: false } : null);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to send friend request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!profile) return;
    
    setActionLoading(true);
    try {
      // We need to find the request ID first
      const requestsResponse = await apiRequest('GET', '/api/friends/requests');
      const requestsData = await requestsResponse.json();
      const request = requestsData.received.find((r: any) => r.fromUser.id === profile.id && r.status === 'pending');
      
      if (request) {
        await apiRequest('PUT', `/api/friends/request/${request.id}/accept`);
        toast({
          title: "Friend request accepted",
          description: `You are now friends with ${profile.displayName}`,
        });
        setProfile(prev => prev ? { ...prev, relationshipStatus: "friends" } : null);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to accept friend request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfriend = async () => {
    if (!profile) return;
    
    setActionLoading(true);
    try {
      await apiRequest('DELETE', `/api/friends/${profile.id}`);
      toast({
        title: "Friend removed",
        description: `You are no longer friends with ${profile.displayName}`,
      });
      setProfile(prev => prev ? { ...prev, relationshipStatus: "none", canSendRequest: true } : null);
      setShowUnfriendDialog(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to remove friend",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "friends":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100"><UserCheck className="h-3 w-3 mr-1" />Friends</Badge>;
      case "pending_sent":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Request Sent</Badge>;
      case "pending_received":
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100"><UserPlus className="h-3 w-3 mr-1" />Request Received</Badge>;
      case "blocked":
        return <Badge variant="destructive"><Shield className="h-3 w-3 mr-1" />Blocked</Badge>;
      default:
        return null;
    }
  };

  const getActionButton = () => {
    if (!profile || !profile.canSendRequest) return null;

    switch (profile.relationshipStatus) {
      case "none":
        return (
          <Button onClick={handleSendFriendRequest} disabled={actionLoading}>
            {actionLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            {actionLoading ? "Sending..." : "Add Friend"}
          </Button>
        );
      case "pending_received":
        return (
          <Button onClick={handleAcceptFriendRequest} disabled={actionLoading}>
            {actionLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4 mr-2" />
            )}
            {actionLoading ? "Accepting..." : "Accept Request"}
          </Button>
        );
      case "friends":
        return (
          <Button 
            variant="outline" 
            onClick={() => setShowUnfriendDialog(true)} 
            disabled={actionLoading}
          >
            <UserMinus className="h-4 w-4 mr-2" />
            Remove Friend
          </Button>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="text-center pb-4">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            <AvatarImage src={profile.avatarUrl} alt={profile.displayName} />
            <AvatarFallback className="text-lg">
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{profile.displayName}</h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
            {getStatusBadge(profile.relationshipStatus)}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {profile.mutualFriendsCount && profile.mutualFriendsCount > 0 && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {profile.mutualFriendsCount} mutual friend{profile.mutualFriendsCount !== 1 ? 's' : ''}
              </p>
              {profile.mutualFriends && profile.mutualFriends.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Including {profile.mutualFriends.slice(0, 2).map(f => f.displayName).join(', ')}
                  {profile.mutualFriends.length > 2 && ` and ${profile.mutualFriends.length - 2} other${profile.mutualFriends.length > 3 ? 's' : ''}`}
                </p>
              )}
            </div>
          )}
          
          <div className="flex gap-2">
            {getActionButton()}
            {onClose && (
              <Button variant="outline" onClick={onClose} className="flex-1">
                Close
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showUnfriendDialog} onOpenChange={setShowUnfriendDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {profile.displayName} as a friend? 
              This will remove them from your friends list and they won't be able to see your comments or tag you anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnfriend}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {actionLoading ? "Removing..." : "Remove Friend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}