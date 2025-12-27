import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, X, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FriendRequest {
  id: string;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  toUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  status: "pending" | "confirmed" | "declined";
  requestedAt: string;
}

interface FriendRequestCardProps {
  request: FriendRequest;
  type: "sent" | "received";
  onRequestUpdate: () => void;
}

export function FriendRequestCard({ request, type, onRequestUpdate }: FriendRequestCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAccept = async () => {
    setIsLoading(true);
    try {
      await apiRequest('PUT', `/api/friends/request/${request.id}/accept`);
      toast({
        title: "Friend request accepted",
        description: `You are now friends with ${request.fromUser.displayName}`,
      });
      onRequestUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to accept request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecline = async () => {
    setIsLoading(true);
    try {
      await apiRequest('PUT', `/api/friends/request/${request.id}/decline`);
      toast({
        title: "Friend request declined",
        description: `Request from ${request.fromUser.displayName} has been declined`,
      });
      onRequestUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to decline request",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const displayUser = type === "received" ? request.fromUser : request.toUser;
  const requestTime = formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true });

  return (
    <Card className="hover:shadow-sm transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={displayUser.avatarUrl} alt={displayUser.displayName} />
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{displayUser.displayName}</p>
              <p className="text-sm text-muted-foreground">
                {type === "received" ? "Sent you a friend request" : "Friend request sent"} {requestTime}
              </p>
            </div>
          </div>
          
          {type === "received" && request.status === "pending" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleAccept}
                disabled={isLoading}
                className="text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDecline}
                disabled={isLoading}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
          )}
          
          {type === "sent" && (
            <div className="text-sm text-muted-foreground">
              {request.status === "pending" ? "Pending" : request.status}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}