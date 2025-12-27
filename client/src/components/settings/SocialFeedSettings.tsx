import { useState, useEffect } from "react";
import { Users, Activity, Eye, EyeOff, Share2, Filter } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface SocialFeedSettings {
  socialFeedEnabled: boolean;
  showFriendActivity: boolean;
  socialFeedPriority: 'social_only' | 'mixed' | 'regular_only';
  shareReadingActivity: boolean;
}

interface SocialFeedSettingsProps {
  className?: string;
}

export function SocialFeedSettings({ className }: SocialFeedSettingsProps) {
  const [settings, setSettings] = useState<SocialFeedSettings>({
    socialFeedEnabled: true,
    showFriendActivity: true,
    socialFeedPriority: 'mixed',
    shareReadingActivity: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      const response = await apiRequest('GET', '/api/users/social-feed-preferences') as any;
      setSettings({
        socialFeedEnabled: response.social_feed_enabled,
        showFriendActivity: response.show_friend_activity,
        socialFeedPriority: response.social_feed_priority,
        shareReadingActivity: response.share_reading_activity,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Failed to load social feed settings",
        description: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (updates: Partial<SocialFeedSettings>) => {
    setIsSaving(true);
    try {
      const updatedSettings = { ...settings, ...updates };
      
      // Convert to API format
      const apiData = {
        social_feed_enabled: updatedSettings.socialFeedEnabled,
        show_friend_activity: updatedSettings.showFriendActivity,
        social_feed_priority: updatedSettings.socialFeedPriority,
        share_reading_activity: updatedSettings.shareReadingActivity,
      };
      
      await apiRequest('PUT', '/api/users/social-feed-preferences', apiData);
      setSettings(updatedSettings);
      toast({
        title: "Social feed settings updated",
        description: "Your social feed preferences have been saved",
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
            <Users className="h-5 w-5" />
            Social Feed Settings
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

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'social_only':
        return <Users className="h-4 w-4" />;
      case 'mixed':
        return <Filter className="h-4 w-4" />;
      case 'regular_only':
        return <Activity className="h-4 w-4" />;
      default:
        return <Filter className="h-4 w-4" />;
    }
  };

  const getPriorityDescription = (priority: string) => {
    switch (priority) {
      case 'social_only':
        return 'Show only articles with friend activity';
      case 'mixed':
        return 'Mix social and regular articles together';
      case 'regular_only':
        return 'Show regular feed without social features';
      default:
        return 'Mix social and regular articles together';
    }
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Social Feed Settings
        </CardTitle>
        <CardDescription>
          Control how social features appear in your news feed
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Enable Social Feed */}
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-3">Social Features</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label htmlFor="social-feed-enabled" className="text-sm font-medium">
                    Enable social feed features
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show friend activity and social interactions in your feed
                  </p>
                </div>
              </div>
              <Switch
                id="social-feed-enabled"
                checked={settings.socialFeedEnabled}
                onCheckedChange={(checked) => 
                  updateSettings({ socialFeedEnabled: checked })
                }
                disabled={isSaving}
              />
            </div>
          </div>
        </div>

        {settings.socialFeedEnabled && (
          <>
            <Separator />

            {/* Friend Activity */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Friend Activity</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {settings.showFriendActivity ? (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="show-friend-activity" className="text-sm font-medium">
                        Show friend activity
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Highlight articles that your friends have commented on or shared
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="show-friend-activity"
                    checked={settings.showFriendActivity}
                    onCheckedChange={(checked) => 
                      updateSettings({ showFriendActivity: checked })
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Feed Priority */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-3">Feed Display</h4>
                <Label className="text-sm text-muted-foreground">
                  How should social content be displayed in your feed?
                </Label>
                <RadioGroup
                  value={settings.socialFeedPriority}
                  onValueChange={(value: 'social_only' | 'mixed' | 'regular_only') => 
                    updateSettings({ socialFeedPriority: value })
                  }
                  className="mt-3 space-y-3"
                  disabled={isSaving}
                >
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="social_only" id="priority-social-only" />
                    <Label htmlFor="priority-social-only" className="flex items-center gap-2 cursor-pointer">
                      {getPriorityIcon('social_only')}
                      <div>
                        <div className="font-medium">Social Only</div>
                        <div className="text-xs text-muted-foreground">
                          {getPriorityDescription('social_only')}
                        </div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="mixed" id="priority-mixed" />
                    <Label htmlFor="priority-mixed" className="flex items-center gap-2 cursor-pointer">
                      {getPriorityIcon('mixed')}
                      <div>
                        <div className="font-medium">Mixed Feed</div>
                        <div className="text-xs text-muted-foreground">
                          {getPriorityDescription('mixed')}
                        </div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="regular_only" id="priority-regular-only" />
                    <Label htmlFor="priority-regular-only" className="flex items-center gap-2 cursor-pointer">
                      {getPriorityIcon('regular_only')}
                      <div>
                        <div className="font-medium">Regular Feed</div>
                        <div className="text-xs text-muted-foreground">
                          {getPriorityDescription('regular_only')}
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
                <h4 className="text-sm font-medium mb-3">Your Activity</h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {settings.shareReadingActivity ? (
                      <Share2 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <Label htmlFor="share-reading-activity" className="text-sm font-medium">
                        Share my reading activity
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Let friends see articles you've commented on or starred
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="share-reading-activity"
                    checked={settings.shareReadingActivity}
                    onCheckedChange={(checked) => 
                      updateSettings({ shareReadingActivity: checked })
                    }
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          </>
        )}

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
                  socialFeedEnabled: true,
                  showFriendActivity: true,
                  socialFeedPriority: 'mixed',
                  shareReadingActivity: true,
                })}
                disabled={isSaving}
              >
                <Users className="h-3 w-3 mr-1" />
                Enable All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateSettings({
                  socialFeedEnabled: false,
                  showFriendActivity: false,
                  socialFeedPriority: 'regular_only',
                  shareReadingActivity: false,
                })}
                disabled={isSaving}
              >
                <Activity className="h-3 w-3 mr-1" />
                Regular Feed Only
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}