import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Download, 
  Trash2, 
  AlertTriangle, 
  Shield, 
  FileText,
  Database,
  Users,
  MessageSquare,
  Bell,
  Settings,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataSummary {
  userId: string;
  friendships: number;
  comments: number;
  blocks: number;
  notifications: number;
  feeds: number;
  articleInteractions: number;
}

export function DataExportSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const { toast } = useToast();

  const loadDataSummary = async () => {
    setIsLoadingSummary(true);
    try {
      const response = await fetch('/api/users/data/summary', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to load data summary');
      }
      
      const data = await response.json();
      setDataSummary(data.summary);
    } catch (error) {
      console.error('Error loading data summary:', error);
      toast({
        title: "Error",
        description: "Failed to load data summary. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const response = await fetch('/api/users/data/export', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to export data');
      }
      
      // Get filename from Content-Disposition header or create default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'cronkite-data-export.json';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Export Complete",
        description: "Your data has been exported successfully."
      });
    } catch (error) {
      console.error('Error exporting data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteData = async () => {
    if (deleteConfirmText !== "DELETE_ALL_MY_DATA") {
      toast({
        title: "Confirmation Required",
        description: "Please type 'DELETE_ALL_MY_DATA' to confirm deletion.",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/users/data', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          confirmDeletion: 'DELETE_ALL_MY_DATA'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete data');
      }
      
      toast({
        title: "Account Deleted",
        description: "All your data has been permanently deleted. You will be logged out.",
      });
      
      // Redirect to home page after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error deleting data:', error);
      toast({
        title: "Deletion Failed",
        description: "Failed to delete your data. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Load data summary on component mount
  useState(() => {
    loadDataSummary();
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Data Export & Privacy</h2>
        <p className="text-muted-foreground">
          Manage your data portability and privacy compliance options.
        </p>
      </div>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Your Data Summary
          </CardTitle>
          <CardDescription>
            Overview of all data associated with your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingSummary ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading data summary...
            </div>
          ) : dataSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <div className="font-semibold">{dataSummary.friendships}</div>
                  <div className="text-sm text-muted-foreground">Friendships</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-green-500" />
                <div>
                  <div className="font-semibold">{dataSummary.comments}</div>
                  <div className="text-sm text-muted-foreground">Comments</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Bell className="h-5 w-5 text-yellow-500" />
                <div>
                  <div className="font-semibold">{dataSummary.notifications}</div>
                  <div className="text-sm text-muted-foreground">Notifications</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="font-semibold">{dataSummary.feeds}</div>
                  <div className="text-sm text-muted-foreground">Feeds</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Settings className="h-5 w-5 text-orange-500" />
                <div>
                  <div className="font-semibold">{dataSummary.articleInteractions}</div>
                  <div className="text-sm text-muted-foreground">Article Interactions</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-red-500" />
                <div>
                  <div className="font-semibold">{dataSummary.blocks}</div>
                  <div className="text-sm text-muted-foreground">Blocked Users</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">
              Failed to load data summary.{" "}
              <Button variant="link" onClick={loadDataSummary} className="p-0 h-auto">
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Export */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Your Data
          </CardTitle>
          <CardDescription>
            Download a complete copy of all your data in JSON format. This includes your profile, 
            settings, social connections, comments, and reading history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your exported data will include all personal information, social connections, and activity history. 
              Keep this file secure and only share it with trusted services.
            </AlertDescription>
          </Alert>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Profile Information</Badge>
            <Badge variant="secondary">Social Connections</Badge>
            <Badge variant="secondary">Comments & Tags</Badge>
            <Badge variant="secondary">Reading History</Badge>
            <Badge variant="secondary">Privacy Settings</Badge>
            <Badge variant="secondary">Feed Subscriptions</Badge>
          </div>
          
          <Button 
            onClick={handleExportData} 
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export My Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Data Deletion */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Delete All Data
          </CardTitle>
          <CardDescription>
            Permanently delete your account and all associated data. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This will permanently delete your entire account, including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Your profile and all personal information</li>
                <li>All social connections and friendships</li>
                <li>All comments and social interactions</li>
                <li>Your feed subscriptions and reading history</li>
                <li>All notifications and privacy settings</li>
              </ul>
            </AlertDescription>
          </Alert>

          {!showDeleteConfirm ? (
            <Button 
              variant="destructive" 
              onClick={() => setShowDeleteConfirm(true)}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-4 p-4 border border-destructive/20 rounded-lg bg-destructive/5">
              <div>
                <label className="text-sm font-medium">
                  Type <code className="bg-muted px-1 py-0.5 rounded text-xs">DELETE_ALL_MY_DATA</code> to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-input rounded-md bg-background"
                  placeholder="DELETE_ALL_MY_DATA"
                />
              </div>
              
              <div className="flex gap-2">
                <Button 
                  variant="destructive" 
                  onClick={handleDeleteData}
                  disabled={isDeleting || deleteConfirmText !== "DELETE_ALL_MY_DATA"}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Permanently Delete
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}