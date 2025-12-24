import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { 
  Clock, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  Zap,
  Calendar,
  Sparkles,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

interface ScheduleSettings {
  medium_priority_hour: number;
  low_priority_day: number;
  low_priority_hour: number;
  ai_clustering_frequency: number;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i === 0 ? "12:00 AM" : i < 12 ? `${i}:00 AM` : i === 12 ? "12:00 PM" : `${i - 12}:00 PM`
}));

const CLUSTERING_FREQUENCIES = [
  { value: 1, label: "Every hour" },
  { value: 4, label: "Every 4 hours" },
  { value: 8, label: "Every 8 hours" },
  { value: 12, label: "Every 12 hours" },
  { value: 24, label: "Once daily" },
];

export function ScheduleSettings() {
  const [settings, setSettings] = useState<ScheduleSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiRequest('GET', '/api/users/settings');
      const data = await response.json();
      setSettings({
        medium_priority_hour: data.settings.medium_priority_hour ?? 9,
        low_priority_day: data.settings.low_priority_day ?? 5,
        low_priority_hour: data.settings.low_priority_hour ?? 9,
        ai_clustering_frequency: data.settings.ai_clustering_frequency ?? 1,
      });
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError('Unable to load schedule settings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const updateSetting = async (key: keyof ScheduleSettings, value: number) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    
    try {
      setIsSaving(true);
      await apiRequest('PUT', '/api/users/settings', { [key]: value });
      toast({
        title: "Settings saved",
        description: "Your schedule preferences have been updated.",
      });
    } catch (err) {
      console.error('Failed to save setting:', err);
      toast({
        title: "Failed to save",
        description: "Could not update your settings. Please try again.",
        variant: "destructive",
      });
      // Revert on error
      fetchSettings();
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Schedule
          </h2>
          <p className="text-muted-foreground">Loading schedule settings...</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-display font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Schedule
          </h2>
          <p className="text-muted-foreground">Failed to load settings</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={fetchSettings} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-display font-bold flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Schedule
            </h2>
            <p className="text-muted-foreground">Configure when feeds sync and AI features run</p>
          </div>
          {isSaving && (
            <Badge variant="secondary" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* High Priority Feeds - No settings, just info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              High Priority Feeds
            </CardTitle>
            <CardDescription>
              Breaking news and time-sensitive sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                High priority feeds sync automatically <span className="font-medium text-foreground">every hour</span> to ensure you never miss breaking news. This setting cannot be changed.
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medium Priority Feeds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Medium Priority Feeds
            </CardTitle>
            <CardDescription>
              Daily news sources and regular publications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                Medium priority feeds sync <span className="font-medium text-foreground">once daily</span> at your preferred time (Eastern Time).
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="medium-hour">Sync Time (ET)</Label>
              <Select
                value={String(settings?.medium_priority_hour ?? 9)}
                onValueChange={(value) => updateSetting('medium_priority_hour', parseInt(value))}
              >
                <SelectTrigger id="medium-hour" className="w-full md:w-[200px]">
                  <SelectValue placeholder="Select time" />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((hour) => (
                    <SelectItem key={hour.value} value={String(hour.value)}>
                      {hour.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Low Priority Feeds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-slate-500" />
              Low Priority Feeds
            </CardTitle>
            <CardDescription>
              Weekly digests and less frequent sources
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                Low priority feeds sync <span className="font-medium text-foreground">once weekly</span> on your chosen day and time (Eastern Time).
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="low-day">Day of Week</Label>
                <Select
                  value={String(settings?.low_priority_day ?? 5)}
                  onValueChange={(value) => updateSetting('low_priority_day', parseInt(value))}
                >
                  <SelectTrigger id="low-day">
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="low-hour">Sync Time (ET)</Label>
                <Select
                  value={String(settings?.low_priority_hour ?? 9)}
                  onValueChange={(value) => updateSetting('low_priority_hour', parseInt(value))}
                >
                  <SelectTrigger id="low-hour">
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map((hour) => (
                      <SelectItem key={hour.value} value={String(hour.value)}>
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* AI Clustering Frequency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Topic Clustering
            </CardTitle>
            <CardDescription>
              How often AI groups related articles into trending topics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="text-sm text-muted-foreground">
                More frequent clustering keeps trending topics fresh but uses more AI resources. Less frequent clustering is more economical.
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="clustering-freq">Clustering Frequency</Label>
              <Select
                value={String(settings?.ai_clustering_frequency ?? 1)}
                onValueChange={(value) => updateSetting('ai_clustering_frequency', parseInt(value))}
              >
                <SelectTrigger id="clustering-freq" className="w-full md:w-[200px]">
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  {CLUSTERING_FREQUENCIES.map((freq) => (
                    <SelectItem key={freq.value} value={String(freq.value)}>
                      {freq.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ScheduleSettings;
