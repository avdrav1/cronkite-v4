import { useState, useEffect } from "react";
import { Users, UserPlus, Send, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiRequest } from "@/lib/queryClient";
import { FriendRequestCard } from "./FriendRequestCard";

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

interface FriendRequestsResponse {
  success: boolean;
  sent: FriendRequest[];
  received: FriendRequest[];
  totalSent: number;
  totalReceived: number;
}

export function FriendRequestList() {
  const [requests, setRequests] = useState<FriendRequestsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/friends/requests');
      const data = await response.json();
      setRequests(data);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load friend requests');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleRequestUpdate = () => {
    fetchRequests();
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
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!requests) {
    return null;
  }

  const pendingReceived = requests.received.filter(r => r.status === "pending");
  const pendingSent = requests.sent.filter(r => r.status === "pending");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Friend Requests</h3>
        <Button variant="outline" size="sm" onClick={fetchRequests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="received" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="received" className="gap-2">
            <UserPlus className="h-4 w-4" />
            Received ({pendingReceived.length})
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <Send className="h-4 w-4" />
            Sent ({pendingSent.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3 mt-4">
          {pendingReceived.length > 0 ? (
            pendingReceived.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                type="received"
                onRequestUpdate={handleRequestUpdate}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending friend requests</p>
              <p className="text-sm">When someone sends you a friend request, it will appear here</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3 mt-4">
          {pendingSent.length > 0 ? (
            pendingSent.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                type="sent"
                onRequestUpdate={handleRequestUpdate}
              />
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pending sent requests</p>
              <p className="text-sm">Friend requests you send will appear here until they're accepted or declined</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}