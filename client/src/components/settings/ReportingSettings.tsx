import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Flag, 
  Shield, 
  AlertTriangle, 
  MessageSquare,
  User,
  Mail,
  CheckCircle,
  Info
} from "lucide-react";

export function ReportingSettings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Reporting & Safety</h2>
        <p className="text-muted-foreground">
          Learn how to report inappropriate content and understand our community guidelines.
        </p>
      </div>

      {/* How to Report */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            How to Report Content
          </CardTitle>
          <CardDescription>
            You can report inappropriate content or behavior directly from the interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium">Report Comments</div>
                <div className="text-sm text-muted-foreground">
                  Click the three-dot menu on any comment and select "Report"
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-medium">Report User Profiles</div>
                <div className="text-sm text-muted-foreground">
                  Visit a user's profile and click "Report User" in the menu
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <div className="font-medium">Contact Support</div>
                <div className="text-sm text-muted-foreground">
                  For serious issues, contact our support team directly
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            What to Report
          </CardTitle>
          <CardDescription>
            Common types of content that violate our community guidelines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
              <Badge variant="destructive">Harassment</Badge>
              <span className="text-sm">Bullying, threats, or targeted abuse</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Spam</Badge>
              <span className="text-sm">Repetitive, unwanted, or promotional content</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Inappropriate</Badge>
              <span className="text-sm">Content that violates community standards</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Fake Account</Badge>
              <span className="text-sm">Impersonation or misleading identity</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Happens Next */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            What Happens After You Report
          </CardTitle>
          <CardDescription>
            Our moderation process and what you can expect
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400">1</div>
              <div>
                <div className="font-medium">Report Received</div>
                <div className="text-sm text-muted-foreground">
                  Your report is logged and queued for review by our moderation team
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-yellow-100 dark:bg-yellow-900 flex items-center justify-center text-xs font-bold text-yellow-600 dark:text-yellow-400">2</div>
              <div>
                <div className="font-medium">Review Process</div>
                <div className="text-sm text-muted-foreground">
                  Our team reviews the content against community guidelines (typically within 24 hours)
                </div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-xs font-bold text-green-600 dark:text-green-400">3</div>
              <div>
                <div className="font-medium">Action Taken</div>
                <div className="text-sm text-muted-foreground">
                  If violations are found, appropriate action is taken (warning, content removal, or account restrictions)
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              We don't share specific details about actions taken against other users, but we take all reports seriously 
              and investigate thoroughly.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Community Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Community Guidelines
          </CardTitle>
          <CardDescription>
            Our commitment to maintaining a safe and respectful environment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h4>Respect Others</h4>
            <p className="text-muted-foreground">
              Treat all community members with respect. Personal attacks, harassment, and discriminatory 
              language are not tolerated.
            </p>

            <h4>Stay On Topic</h4>
            <p className="text-muted-foreground">
              Keep discussions relevant to the articles and topics being discussed. Avoid spam or 
              off-topic content.
            </p>

            <h4>Be Authentic</h4>
            <p className="text-muted-foreground">
              Use your real identity and don't impersonate others. Fake accounts and misleading 
              information undermine trust in our community.
            </p>

            <h4>Privacy Matters</h4>
            <p className="text-muted-foreground">
              Respect others' privacy. Don't share personal information without consent, and be 
              mindful of what you share about yourself.
            </p>
          </div>

          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Violations of these guidelines may result in warnings, content removal, or account restrictions. 
              Serious or repeated violations may lead to permanent account suspension.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}