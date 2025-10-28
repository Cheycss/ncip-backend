import pool from '../database.js';

/**
 * Auto-cancel applications that are past their deadline
 * and don't have all required documents submitted
 */
export async function autoCancelOverdueApplications() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔍 Checking for overdue applications...');
    
    await connection.beginTransaction();
    
    // Find applications that are overdue and incomplete
    const [overdueApps] = await connection.query(`
      SELECT 
        a.application_id,
        a.user_id,
        a.application_number,
        a.purpose,
        a.submission_deadline,
        DATEDIFF(CURDATE(), a.submission_deadline) as days_overdue,
        COUNT(rc.compliance_id) as total_requirements,
        SUM(CASE WHEN rc.is_submitted = TRUE THEN 1 ELSE 0 END) as submitted_requirements,
        SUM(CASE WHEN rc.is_approved = TRUE THEN 1 ELSE 0 END) as approved_requirements,
        SUM(CASE WHEN rc.is_missing = TRUE THEN 1 ELSE 0 END) as missing_requirements
      FROM applications a
      LEFT JOIN requirement_compliance rc ON a.application_id = rc.application_id
      WHERE a.application_status IN ('submitted', 'under_review')
        AND a.is_cancelled = FALSE
        AND a.submission_deadline < CURDATE()
      GROUP BY a.application_id
      HAVING missing_requirements > 0
    `);

    if (overdueApps.length === 0) {
      console.log('✅ No overdue applications found');
      await connection.commit();
      return { cancelled: 0, message: 'No overdue applications' };
    }

    console.log(`⚠️ Found ${overdueApps.length} overdue application(s)`);

    let cancelledCount = 0;

    for (const app of overdueApps) {
      console.log(`📋 Cancelling application #${app.application_number}...`);
      
      // Cancel the application
      await connection.query(`
        UPDATE applications
        SET is_cancelled = TRUE,
            cancellation_reason = ?,
            cancelled_at = NOW(),
            application_status = 'cancelled'
        WHERE application_id = ?
      `, [
        `Automatic cancellation: Failed to submit all requirements within deadline. Missing ${app.missing_requirements} document(s). Deadline was ${app.submission_deadline}.`,
        app.application_id
      ]);

      // Log the cancellation
      await connection.query(`
        INSERT INTO cancellation_log (
          application_id,
          user_id,
          cancellation_type,
          cancellation_reason,
          total_requirements,
          submitted_requirements,
          approved_requirements,
          missing_requirements,
          days_past_deadline
        ) VALUES (?, ?, 'automatic', ?, ?, ?, ?, ?, ?)
      `, [
        app.application_id,
        app.user_id,
        `Failed to submit all requirements within deadline. Missing ${app.missing_requirements} document(s).`,
        app.total_requirements,
        app.submitted_requirements,
        app.approved_requirements,
        app.missing_requirements,
        app.days_overdue
      ]);

      // Create notification for user
      await connection.query(`
        INSERT INTO notification_queue (
          user_id,
          application_id,
          notification_type,
          title,
          message,
          priority
        ) VALUES (?, ?, 'application_cancelled', ?, ?, 'high')
      `, [
        app.user_id,
        app.application_id,
        '🚨 Application Cancelled',
        `Your application #${app.application_number} for ${app.purpose} has been automatically cancelled due to incomplete requirements. You were missing ${app.missing_requirements} document(s). You may submit a new application.`
      ]);

      cancelledCount++;
      console.log(`✅ Cancelled application #${app.application_number}`);
    }

    await connection.commit();
    
    console.log(`✅ Successfully cancelled ${cancelledCount} application(s)`);
    
    return {
      cancelled: cancelledCount,
      message: `Cancelled ${cancelledCount} overdue application(s)`,
      applications: overdueApps.map(app => ({
        application_number: app.application_number,
        days_overdue: app.days_overdue,
        missing_requirements: app.missing_requirements
      }))
    };

  } catch (error) {
    await connection.rollback();
    console.error('❌ Error auto-cancelling applications:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Send deadline warning notifications
 * For applications approaching their deadline
 */
export async function sendDeadlineWarnings() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔔 Checking for applications with approaching deadlines...');
    
    // Find applications with deadlines in 7, 3, or 1 day(s)
    const [approachingDeadline] = await connection.query(`
      SELECT 
        a.application_id,
        a.user_id,
        a.application_number,
        a.purpose,
        a.submission_deadline,
        a.days_remaining,
        COUNT(rc.compliance_id) as total_requirements,
        SUM(CASE WHEN rc.is_missing = TRUE THEN 1 ELSE 0 END) as missing_requirements
      FROM applications a
      LEFT JOIN requirement_compliance rc ON a.application_id = rc.application_id
      WHERE a.application_status IN ('submitted', 'under_review')
        AND a.is_cancelled = FALSE
        AND a.days_remaining IN (7, 3, 1)
      GROUP BY a.application_id
      HAVING missing_requirements > 0
    `);

    if (approachingDeadline.length === 0) {
      console.log('✅ No deadline warnings needed');
      return { sent: 0, message: 'No warnings needed' };
    }

    console.log(`⚠️ Found ${approachingDeadline.length} application(s) with approaching deadlines`);

    let sentCount = 0;

    for (const app of approachingDeadline) {
      const notificationType = app.days_remaining === 7 
        ? 'deadline_warning_7days'
        : app.days_remaining === 3
        ? 'deadline_warning_3days'
        : 'deadline_warning_1day';

      const urgency = app.days_remaining === 1 ? '🚨 URGENT' : '⚠️ WARNING';
      
      await connection.query(`
        INSERT INTO notification_queue (
          user_id,
          application_id,
          notification_type,
          title,
          message,
          priority
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [
        app.user_id,
        app.application_id,
        notificationType,
        `${urgency}: Deadline in ${app.days_remaining} day${app.days_remaining !== 1 ? 's' : ''}!`,
        `Your application #${app.application_number} deadline is in ${app.days_remaining} day${app.days_remaining !== 1 ? 's' : ''}! You still have ${app.missing_requirements} missing document(s). Upload them now or your application will be automatically cancelled.`,
        app.days_remaining === 1 ? 'urgent' : 'high'
      ]);

      sentCount++;
      console.log(`📧 Sent warning for application #${app.application_number} (${app.days_remaining} days remaining)`);
    }

    console.log(`✅ Sent ${sentCount} deadline warning(s)`);
    
    return {
      sent: sentCount,
      message: `Sent ${sentCount} deadline warning(s)`
    };

  } catch (error) {
    console.error('❌ Error sending deadline warnings:', error);
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  autoCancelOverdueApplications,
  sendDeadlineWarnings
};
