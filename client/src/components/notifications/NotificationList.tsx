import { useState, useEffect } from "react";
import { Bell, BellOff, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { NotificationCard } from "./NotificationCard";
import type { NotificationType } from "@shared/schema";

interface NotificationData {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any>;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

interface NotificationListProps {
  className?: string;
}

export function NotificationList({ className }: NotificationListProps) {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { toast } = useToast();

  const fetchNotifications = async () => {
    try {
      const response = await apiRequest('GET', '/api/notifications') as any;
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load notifications",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (unreadCount === 0) return;

    setIsMarkingAllRead(true);
    try {
      await apiRequest('PUT', '/api/notifications/mark-all-read');
      await fetchNotifications();
      toast({
        title: "All notifications marked as read",
        description: `${unreadCount} notifications marked as read`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to mark all as read",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications = showUnreadOnly 
    ? notifications.filter(n => !n.readAt)
    : notifications;

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
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
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {unreadCount} new
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUnreadOnly(!showUnreadOnly)}
              className="text-xs"
            >
              {showUnreadOnly ? (
                <>
                  <Bell className="h-3 w-3 mr-1" />
                  Show All
                </>
              ) : (
                <>
                  <BellOff className="h-3 w-3 mr-1" />
                  Unread Only
                </>
              )}
            </Button>
            
            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleMarkAllAsRead}
                disabled={isMarkingAllRead}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark All Read
              </Button>
            )}
          </div>
        </div>
        
        <CardDescription>
          Stay updated with friend requests, comments, and social activity
        </CardDescription>
      </CardHeader>
      
      <Separator />
      
      <CardContent className="p-0">
        {filteredNotifications.length === 0 ? (
          <div className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {showUnreadOnly ? <BellOff className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                </EmptyMedia>
                <EmptyTitle>
                  {showUnreadOnly ? "No unread notifications" : "No notifications"}
                </EmptyTitle>
                <EmptyDescription>
                  {showUnreadOnly 
                    ? "You're all caught up! No new notifications to review."
                    : "You'll see friend requests, comments, and other social activity here."
                  }
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="p-4 space-y-3">
              {filteredNotifications.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onNotificationUpdate={fetchNotifications}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}