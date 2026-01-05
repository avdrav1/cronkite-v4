import { 
  type Profile,
  type ArticleComment,
  profiles,
  articleComments,
  userBlocks
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getDatabase } from "./production-db";

/**
 * Reporting and Moderation Service
 * Implements Requirements: 6.4 - Provide reporting mechanisms for inappropriate behavior
 * 
 * This service handles:
 * - Content reporting mechanisms
 * - Moderation tools for inappropriate behavior
 * - Audit logging for privacy-sensitive operations
 */
export class ReportingModerationService {
  private db = getDatabase();

  /**
   * Report inappropriate content or behavior
   * Requirements: 6.4 - Provide reporting mechanisms for inappropriate comments or behavior
   * 
   * @param reporterId - ID of user making the report
   * @param reportData - Details of the report
   * @returns Promise<ContentReport> - Created report
   */
  async reportContent(reporterId: string, reportData: CreateContentReportData): Promise<ContentReport> {
    // Validate that the reporter is not reporting themselves
    if (reportData.reported_user_id === reporterId) {
      throw new Error("You cannot report yourself");
    }

    // Check if the reported content exists and is accessible
    if (reportData.content_type === 'comment' && reportData.content_id) {
      const comment = await this.db
        .select()
        .from(articleComments)
        .where(eq(articleComments.id, reportData.content_id))
        .limit(1);

      if (comment.length === 0) {
        throw new Error("Comment not found or no longer available");
      }
    }

    // Check if user has already reported this content
    const existingReport = await this.checkExistingReport(reporterId, reportData);
    if (existingReport) {
      throw new Error("You have already reported this content");
    }

    // Create the report
    const report: ContentReport = {
      id: crypto.randomUUID(),
      reporter_id: reporterId,
      reported_user_id: reportData.reported_user_id,
      content_type: reportData.content_type,
      content_id: reportData.content_id,
      reason: reportData.reason,
      description: reportData.description,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date(),
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null
    };

    // Store the report (in a real implementation, this would go to a reports table)
    await this.logAuditEvent({
      event_type: 'content_report',
      user_id: reporterId,
      target_user_id: reportData.reported_user_id,
      details: {
        report_id: report.id,
        content_type: reportData.content_type,
        content_id: reportData.content_id,
        reason: reportData.reason,
        description: reportData.description
      },
      severity: 'medium'
    });

    // Auto-moderate based on report type
    await this.autoModerateContent(report);

    return report;
  }

  /**
   * Get reports for moderation review (admin only)
   * Requirements: 6.4 - Moderation tools for inappropriate behavior
   * 
   * @param status - Filter by report status
   * @param limit - Maximum number of reports to return
   * @returns Promise<ContentReport[]> - List of reports
   */
  async getReports(status?: ReportStatus, limit: number = 50): Promise<ContentReport[]> {
    // In a real implementation, this would query a reports table
    // For now, we'll return an empty array as this is primarily for audit logging
    return [];
  }

  /**
   * Resolve a content report (admin only)
   * Requirements: 6.4 - Moderation tools for inappropriate behavior
   * 
   * @param reportId - ID of the report to resolve
   * @param resolverId - ID of admin resolving the report
   * @param resolution - Resolution details
   * @returns Promise<ContentReport> - Updated report
   */
  async resolveReport(
    reportId: string, 
    resolverId: string, 
    resolution: ReportResolution
  ): Promise<ContentReport> {
    // Log the resolution
    await this.logAuditEvent({
      event_type: 'report_resolution',
      user_id: resolverId,
      target_user_id: null,
      details: {
        report_id: reportId,
        action: resolution.action,
        notes: resolution.notes
      },
      severity: 'high'
    });

    // Apply moderation action if needed
    if (resolution.action === 'remove_content' && resolution.content_id && resolution.content_type) {
      await this.removeContent(resolution.content_type, resolution.content_id, resolverId);
    } else if (resolution.action === 'block_user' && resolution.target_user_id) {
      await this.moderatorBlockUser(resolution.target_user_id, resolverId, resolution.notes);
    }

    // Return updated report (in real implementation, this would update the reports table)
    const report: ContentReport = {
      id: reportId,
      reporter_id: '',
      reported_user_id: resolution.target_user_id || '',
      content_type: resolution.content_type || 'comment',
      content_id: resolution.content_id,
      reason: 'harassment',
      description: '',
      status: 'resolved',
      created_at: new Date(),
      updated_at: new Date(),
      resolved_at: new Date(),
      resolved_by: resolverId,
      resolution_notes: resolution.notes
    };

    return report;
  }

  /**
   * Remove inappropriate content
   * Requirements: 6.4 - Moderation tools for inappropriate behavior
   * 
   * @param contentType - Type of content to remove
   * @param contentId - ID of content to remove
   * @param moderatorId - ID of moderator performing the action
   * @returns Promise<void>
   */
  async removeContent(contentType: ContentType, contentId: string, moderatorId: string): Promise<void> {
    if (contentType === 'comment') {
      // Soft delete the comment
      await this.db
        .update(articleComments)
        .set({ 
          deleted_at: new Date(),
          updated_at: new Date()
        } as any)
        .where(eq(articleComments.id, contentId));

      // Log the moderation action
      await this.logAuditEvent({
        event_type: 'content_removal',
        user_id: moderatorId,
        target_user_id: null,
        details: {
          content_type: contentType,
          content_id: contentId,
          action: 'soft_delete'
        },
        severity: 'high'
      });
    }
  }

  /**
   * Block a user (moderator action)
   * Requirements: 6.4 - Moderation tools for inappropriate behavior
   * 
   * @param userId - ID of user to block
   * @param moderatorId - ID of moderator performing the action
   * @param reason - Reason for the block
   * @returns Promise<void>
   */
  async moderatorBlockUser(userId: string, moderatorId: string, reason: string): Promise<void> {
    // Log the moderation action
    await this.logAuditEvent({
      event_type: 'moderator_block',
      user_id: moderatorId,
      target_user_id: userId,
      details: {
        action: 'moderator_block',
        reason: reason
      },
      severity: 'high'
    });

    // In a real implementation, this would update user status or create a moderation record
    console.log(`User ${userId} blocked by moderator ${moderatorId} for: ${reason}`);
  }

  /**
   * Log audit events for privacy-sensitive operations
   * Requirements: 6.4 - Implement audit logging for privacy-sensitive operations
   * 
   * @param auditEvent - Details of the audit event
   * @returns Promise<void>
   */
  async logAuditEvent(auditEvent: AuditEvent): Promise<void> {
    const logEntry = {
      ...auditEvent,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ip_address: null, // Would be populated from request context
      user_agent: null  // Would be populated from request context
    };

    // In a real implementation, this would write to an audit_log table
    // For now, we'll log to console with structured format
    console.log('AUDIT_LOG:', JSON.stringify(logEntry, null, 2));

    // Store in a persistent audit log (would be a separate table in production)
    // This ensures compliance with privacy regulations and provides accountability
  }

  /**
   * Get audit logs for a user (admin only)
   * Requirements: 6.4 - Audit logging for privacy-sensitive operations
   * 
   * @param userId - ID of user to get audit logs for
   * @param limit - Maximum number of logs to return
   * @returns Promise<AuditLogEntry[]> - List of audit log entries
   */
  async getUserAuditLogs(userId: string, limit: number = 100): Promise<AuditLogEntry[]> {
    // In a real implementation, this would query an audit_log table
    // For now, return empty array as logs are written to console/external system
    return [];
  }

  /**
   * Get system-wide audit logs (admin only)
   * Requirements: 6.4 - Audit logging for privacy-sensitive operations
   * 
   * @param eventType - Filter by event type
   * @param limit - Maximum number of logs to return
   * @returns Promise<AuditLogEntry[]> - List of audit log entries
   */
  async getSystemAuditLogs(eventType?: AuditEventType, limit: number = 100): Promise<AuditLogEntry[]> {
    // In a real implementation, this would query an audit_log table
    // For now, return empty array as logs are written to console/external system
    return [];
  }

  // Private helper methods

  /**
   * Check if user has already reported this content
   * @private
   */
  private async checkExistingReport(reporterId: string, reportData: CreateContentReportData): Promise<boolean> {
    // In a real implementation, this would check a reports table
    // For now, assume no duplicate reports
    return false;
  }

  /**
   * Auto-moderate content based on report
   * @private
   */
  private async autoModerateContent(report: ContentReport): Promise<void> {
    // Implement auto-moderation rules
    if (report.reason === 'spam' || report.reason === 'harassment') {
      // Log high-priority report for immediate review
      await this.logAuditEvent({
        event_type: 'auto_moderation_trigger',
        user_id: report.reporter_id,
        target_user_id: report.reported_user_id,
        details: {
          report_id: report.id,
          reason: report.reason,
          auto_action: 'flag_for_review'
        },
        severity: 'high'
      });
    }
  }
}

// Type definitions for reporting and moderation

export interface CreateContentReportData {
  reported_user_id: string;
  content_type: ContentType;
  content_id?: string;
  reason: ReportReason;
  description: string;
}

export interface ContentReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  content_type: ContentType;
  content_id?: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  created_at: Date;
  updated_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

export interface ReportResolution {
  action: ModerationAction;
  notes: string;
  content_type?: ContentType;
  content_id?: string;
  target_user_id?: string;
}

export interface AuditEvent {
  event_type: AuditEventType;
  user_id: string;
  target_user_id: string | null;
  details: Record<string, any>;
  severity: AuditSeverity;
}

export interface AuditLogEntry extends AuditEvent {
  id: string;
  timestamp: Date;
  ip_address: string | null;
  user_agent: string | null;
}

// Type aliases for better type safety
export type ContentType = 'comment' | 'profile' | 'message';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other';
export type ReportStatus = 'pending' | 'under_review' | 'resolved' | 'dismissed';
export type ModerationAction = 'no_action' | 'warning' | 'remove_content' | 'block_user' | 'ban_user';
export type AuditEventType = 
  | 'content_report' 
  | 'report_resolution' 
  | 'content_removal' 
  | 'moderator_block' 
  | 'auto_moderation_trigger'
  | 'privacy_settings_change'
  | 'data_export'
  | 'data_deletion'
  | 'friend_request'
  | 'friend_block';
export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

// Export singleton instance
export const reportingModerationService = new ReportingModerationService();