import { useState, useEffect } from "react";
import { Shield, Eye, EyeOff, Users, Globe, Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { PrivacyLevel } from "@shared/schema";

interface PrivacySettings {
  discoverable: boolean;
  allowFriendRequestsFrom: PrivacyLevel;
  showActivityTo: PrivacyLevel;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

interface PrivacySettingsProps {
  className?: string;
}

export function PrivacySettings({ className }: PrivacySettingsProps) {
  const [settings, setSettings] = useState<PrivacySettings>({
    discoverable: true,
    allowFriendRequestsFrom: 'everyone',
    showActivityTo: 'friends',
    emailNotifications: true,
    pushNotifications: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const response = await apiRequest('GET', '/api/users/privacy') as any;
      setSettings({
        discoverable: response.discoverable,
        allowFriendRequestsFrom: response.allow_friend_requests_from,
        showActivityTo: response.show_activity_to,
        emailNotifications: response.email_notifications,
        pushNotifications: response.push_notifications,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load privacy settings",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<PrivacySettings>) => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...settings, ...updates };
      
      // Convert to API format
      const apiData = {
        discoverable: updatedSettings.discoverable,
        allow_friend_requests_from: updatedSettings.allowFriendRequestsFrom,
        show_activity_to: updatedSettings.showActivityTo,
        email_notifications: updatedSettings.emailNotifications,
        push_notifications: updatedSettings.pushNotifications,
      };
      
      await apiRequest('PUT', '/api/users/privacy', apiData);
      setSettings(updatedSettings);
      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to update settings",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Settings
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

  const getPrivacyIcon = (level: PrivacyLevel) => {
    switch (level) {
      case 'everyone':
        return <Globe className="h-4 w-4" />;
      case 'friends':
        return <Users className="h-4 w-4" />;
      case 'nobody':
        return <Lock className="h-4 w-4" />;
    }
  };

  const getPrivacyDescription = (level: PrivacyLevel) => {
    switch (level) {
      case 'everyone':
        return 'Anyone can find and interact with you';
      case 'friends':
        return 'Only confirmed friends can interact with you';
      case 'nobody':
        return 'No one can find or interact with you';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Privacy Settings
        </CardTitle>
        <CardDescription>
          Control who can find you and interact with your content
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Profile Discoverability */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Profile Visibility</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings.discoverable ? (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="discoverable" className="text-sm font-medium">
                    Make my profile discoverable
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Allow others to find your profile in search results
                  </p>
                </div>
              </div>
              <Switch
                id="discoverable"
                checked={settings.discoverable}
                onCheckedChange={(checked) => 
                  updateSettings({ discoverable: checked })
                }
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Friend Request Settings */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Friend Requests</h4>
            <Label className="text-sm text-muted-foreground">
              Who can send you friend requests?
            </Label>
            <RadioGroup
              value={settings.allowFriendRequestsFrom}
              onValueChange={(value: PrivacyLevel) => 
                updateSettings({ allowFriendRequestsFrom: value })
              }
              className="mt-3 space-y-3"
              disabled={isSaving}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="everyone" id="friend-requests-everyone" />
                <Label htmlFor="friend-requests-everyone" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('everyone')}
                  <div>
                    <div className="font-medium">Everyone</div>
                    <div className="text-xs text-muted-foreground">
                      Anyone can send you friend requests
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="friends" id="friend-requests-friends" />
                <Label htmlFor="friend-requests-friends" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('friends')}
                  <div>
                    <div className="font-medium">Friends of Friends</div>
                    <div className="text-xs text-muted-foreground">
                      Only people connected to your friends
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="nobody" id="friend-requests-nobody" />
                <Label htmlFor="friend-requests-nobody" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('nobody')}
                  <div>
                    <div className="font-medium">Nobody</div>
                    <div className="text-xs text-muted-foreground">
                      Disable friend requests completely
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Separator />

        {/* Activity Sharing */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Activity Sharing</h4>
            <Label className="text-sm text-muted-foreground">
              Who can see your reading activity and comments?
            </Label>
            <RadioGroup
              value={settings.showActivityTo}
              onValueChange={(value: PrivacyLevel) => 
                updateSettings({ showActivityTo: value })
              }
              className="mt-3 space-y-3"
              disabled={isSaving}
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="everyone" id="activity-everyone" />
                <Label htmlFor="activity-everyone" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('everyone')}
                  <div>
                    <div className="font-medium">Everyone</div>
                    <div className="text-xs text-muted-foreground">
                      Anyone can see your activity
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="friends" id="activity-friends" />
                <Label htmlFor="activity-friends" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('friends')}
                  <div>
                    <div className="font-medium">Friends Only</div>
                    <div className="text-xs text-muted-foreground">
                      Only confirmed friends can see your activity
                    </div>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="nobody" id="activity-nobody" />
                <Label htmlFor="activity-nobody" className="flex items-center gap-2 cursor-pointer">
                  {getPrivacyIcon('nobody')}
                  <div>
                    <div className="font-medium">Private</div>
                    <div className="text-xs text-muted-foreground">
                      Keep all activity private
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <Separator />

        {/* Quick Actions */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Quick Settings</h4>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSettings({
                  discoverable: true,
                  allowFriendRequestsFrom: 'everyone',
                  showActivityTo: 'friends',
                })}
                disabled={isSaving}
              >
                <Globe className="h-3 w-3 mr-1" />
                Open
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSettings({
                  discoverable: false,
                  allowFriendRequestsFrom: 'nobody',
                  showActivityTo: 'nobody',
                })}
                disabled={isSaving}
              >
                <Lock className="h-3 w-3 mr-1" />
                Private
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}