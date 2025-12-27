import { useState, useEffect } from "react";
import { Bell, Mail, Smartphone, MessageCircle, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface NotificationPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  friendRequestNotifications: boolean;
  commentTagNotifications: boolean;
  commentReplyNotifications: boolean;
}

interface NotificationPreferencesProps {
  className?: string;
}

export function NotificationPreferences({ className }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: true,
    pushNotifications: true,
    friendRequestNotifications: true,
    commentTagNotifications: true,
    commentReplyNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchPreferences = async () => {
    try {
      const response = await apiRequest('GET', '/api/notifications/preferences') as any;
      setPreferences(response);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load preferences",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    setIsSaving(true);
    try {
      const updatedPreferences = { ...preferences, ...updates };
      await apiRequest('PUT', '/api/notifications/preferences', updatedPreferences);
      setPreferences(updatedPreferences);
      toast({
        title: "Preferences updated",
        description: "Your notification preferences have been saved",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update preferences",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
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
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Control how and when you receive notifications about social activity
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Delivery Methods */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Delivery Methods</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="email-notifications" className="text-sm font-medium">
                      Email Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive notifications via email
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-notifications"
                  checked={preferences.emailNotifications}
                  onCheckedChange={(checked) => 
                    updatePreferences({ emailNotifications: checked })
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="push-notifications" className="text-sm font-medium">
                      Push Notifications
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Receive push notifications on your device
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-notifications"
                  checked={preferences.pushNotifications}
                  onCheckedChange={(checked) => 
                    updatePreferences({ pushNotifications: checked })
                  }
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Notification Types */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Notification Types</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="friend-requests" className="text-sm font-medium">
                      Friend Requests
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      New friend requests and acceptances
                    </p>
                  </div>
                </div>
                <Switch
                  id="friend-requests"
                  checked={preferences.friendRequestNotifications}
                  onCheckedChange={(checked) => 
                    updatePreferences({ friendRequestNotifications: checked })
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="comment-tags" className="text-sm font-medium">
                      Comment Tags
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When friends tag you in comments
                    </p>
                  </div>
                </div>
                <Switch
                  id="comment-tags"
                  checked={preferences.commentTagNotifications}
                  onCheckedChange={(checked) => 
                    updatePreferences({ commentTagNotifications: checked })
                  }
                  disabled={isSaving}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="comment-replies" className="text-sm font-medium">
                      Comment Replies
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      When friends reply to your comments
                    </p>
                  </div>
                </div>
                <Switch
                  id="comment-replies"
                  checked={preferences.commentReplyNotifications}
                  onCheckedChange={(checked) => 
                    updatePreferences({ commentReplyNotifications: checked })
                  }
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Additional Settings */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updatePreferences({
                  emailNotifications: true,
                  pushNotifications: true,
                  friendRequestNotifications: true,
                  commentTagNotifications: true,
                  commentReplyNotifications: true,
                })}
                disabled={isSaving}
              >
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updatePreferences({
                  emailNotifications: false,
                  pushNotifications: false,
                  friendRequestNotifications: false,
                  commentTagNotifications: false,
                  commentReplyNotifications: false,
                })}
                disabled={isSaving}
              >
                Disable All
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}