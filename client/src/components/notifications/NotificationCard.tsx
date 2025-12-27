import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, User, MessageCircle, UserPlus, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

interface NotificationCardProps {
  notification: NotificationData;
  onNotificationUpdate: () => void;
}

export function NotificationCard({ notification, onNotificationUpdate }: NotificationCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleMarkAsRead = async () => {
    if (notification.readAt) return; // Already read

    setIsLoading(true);
    try {
      await apiRequest('PUT', `/api/notifications/${notification.id}/read`);
      onNotificationUpdate();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to mark as read",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'friend_request':
        return <UserPlus className="h-4 w-4" />;
      case 'friend_accepted':
        return <UserCheck className="h-4 w-4" />;
      case 'comment_tag':
      case 'comment_reply':
        return <MessageCircle className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const getNotificationColor = () => {
    switch (notification.type) {
      case 'friend_request':
        return "text-blue-600";
      case 'friend_accepted':
        return "text-green-600";
      case 'comment_tag':
      case 'comment_reply':
        return "text-purple-600";
      default:
        return "text-gray-600";
    }
  };

  const handleNotificationClick = () => {
    // Mark as read when clicked
    if (!notification.readAt) {
      handleMarkAsRead();
    }

    // Navigate based on notification type
    switch (notification.type) {
      case 'friend_request':
        // Navigate to friend requests page
        window.location.href = '/settings?tab=friends';
        break;
      case 'friend_accepted':
        // Navigate to friends list
        window.location.href = '/settings?tab=friends';
        break;
      case 'comment_tag':
      case 'comment_reply':
        // Navigate to the article with the comment
        if (notification.data.articleId) {
          window.location.href = `/article/${notification.data.articleId}`;
        }
        break;
    }
  };

  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
  const isUnread = !notification.readAt;

  return (
    <Card 
      className={`hover:shadow-sm transition-all cursor-pointer ${
        isUnread ? 'bg-blue-50/50 border-blue-200' : 'hover:bg-gray-50'
      }`}
      onClick={handleNotificationClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Notification Icon */}
          <div className={`flex-shrink-0 p-2 rounded-full bg-gray-100 ${getNotificationColor()}`}>
            {getNotificationIcon()}
          </div>

          {/* Avatar (if available) */}
          {notification.data.fromUserAvatar || notification.data.taggerUserAvatar || notification.data.replierUserAvatar ? (
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarImage 
                src={
                  notification.data.fromUserAvatar || 
                  notification.data.taggerUserAvatar || 
                  notification.data.replierUserAvatar ||
                  notification.data.acceptedByUserAvatar
                } 
                alt="User avatar" 
              />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          ) : null}

          {/* Notification Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={`font-medium text-sm ${isUnread ? 'text-gray-900' : 'text-gray-700'}`}>
                  {notification.title}
                </p>
                <p className={`text-sm mt-1 ${isUnread ? 'text-gray-700' : 'text-gray-600'}`}>
                  {notification.message}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {timeAgo}
                </p>
              </div>

              {/* Unread indicator and actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {isUnread && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    New
                  </Badge>
                )}
                
                {isUnread && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkAsRead();
                    }}
                    disabled={isLoading}
                    className="h-6 w-6 p-0 hover:bg-gray-200"
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}