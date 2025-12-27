import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Shield, User, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface BlockedUser {
  id: string;
  blockedUser: {
    id: string;
    displayName: string;
    avatarUrl?: string;
  };
  blockedAt: string;
}

interface BlockedUsersProps {
  className?: string;
}

export function BlockedUsers({ className }: BlockedUsersProps) {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBlockedUsers = async () => {
    try {
      const response = await apiRequest('GET', '/api/users/blocked') as any;
      setBlockedUsers(response.blockedUsers || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load blocked users",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblockUser = async (blockedUserId: string, displayName: string) => {
    setUnblockingUserId(blockedUserId);
    try {
      await apiRequest('DELETE', `/api/users/block/${blockedUserId}`);
      await fetchBlockedUsers();
      toast({
        title: "User unblocked",
        description: `${displayName} has been unblocked and can now interact with you again`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to unblock user",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setUnblockingUserId(null);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Blocked Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>Blocked Users</CardTitle>
            {blockedUsers.length > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                {blockedUsers.length} blocked
              </Badge>
            )}
          </div>
        </div>
        
        <CardDescription>
          Manage users you've blocked from interacting with you
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="p-0">
        {blockedUsers.length === 0 ? (
          <div className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Shield className="h-6 w-6" />
                </EmptyMedia>
                <EmptyTitle>No blocked users</EmptyTitle>
                <EmptyDescription>
                  You haven't blocked anyone yet. Blocked users cannot send you friend requests, comment on your articles, or tag you in comments.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <>
            {/* Info Banner */}
            <div className="p-4 bg-amber-50 border-b border-amber-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800">About blocking</p>
                  <p className="text-amber-700 mt-1">
                    Blocked users cannot send you friend requests, see your profile, comment on your articles, or tag you in comments. 
                    They won't be notified that they've been blocked.
                  </p>
                </div>
              </div>
            </div>

            <ScrollArea className="h-[400px]">
              <div className="p-4 space-y-3">
                {blockedUsers.map((blockedUser) => {
                  const timeAgo = formatDistanceToNow(new Date(blockedUser.blockedAt), { addSuffix: true });
                  const isUnblocking = unblockingUserId === blockedUser.blockedUser.id;

                  return (
                    <Card key={blockedUser.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage 
                                src={blockedUser.blockedUser.avatarUrl} 
                                alt={blockedUser.blockedUser.displayName} 
                              />
                              <AvatarFallback>
                                <User className="h-5 w-5" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{blockedUser.blockedUser.displayName}</p>
                              <p className="text-sm text-muted-foreground">
                                Blocked {timeAgo}
                              </p>
                            </div>
                          </div>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isUnblocking}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Unblock
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Unblock {blockedUser.blockedUser.displayName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will allow {blockedUser.blockedUser.displayName} to:
                                  <ul className="list-disc list-inside mt-2 space-y-1">
                                    <li>Send you friend requests</li>
                                    <li>See your profile (if discoverable)</li>
                                    <li>Comment on your articles (if you're friends)</li>
                                    <li>Tag you in comments (if you're friends)</li>
                                  </ul>
                                  <p className="mt-2">
                                    You can block them again at any time if needed.
                                  </p>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleUnblockUser(
                                    blockedUser.blockedUser.id, 
                                    blockedUser.blockedUser.displayName
                                  )}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Unblock User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}