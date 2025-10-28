import pool from '../database.js';

/**
 * Send a notification to a user
 * @param {number} userId - The user ID to send notification to
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - Notification type (info, success, warning, error)
 * @param {number} relatedApplicationId - Optional related application ID
 */
export async function sendNotification(userId, title, message, type = 'info', relatedApplicationId = null) {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, related_application_id) 
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, type, relatedApplicationId]
    );
    console.log(`✅ Notification sent to user ${userId}: ${title}`);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}

/**
 * Send application status change notification
 * @param {number} userId - User ID
 * @param {number} applicationId - Application ID
 * @param {string} applicationNumber - Application number
 * @param {string} status - New status
 */
export async function notifyApplicationStatusChange(userId, applicationId, applicationNumber, status) {
  const statusMessages = {
    submitted: {
      title: 'Application Submitted',
      message: `Your application ${applicationNumber} has been successfully submitted and is awaiting review.`,
      type: 'success'
    },
    under_review: {
      title: 'Application Under Review',
      message: `Your application ${applicationNumber} is now under review by our team.`,
      type: 'info'
    },
    approved: {
      title: 'Application Approved',
      message: `Congratulations! Your application ${applicationNumber} has been approved.`,
      type: 'success'
    },
    rejected: {
      title: 'Application Rejected',
      message: `Your application ${applicationNumber} has been rejected. Please check the reviewer notes for details.`,
      type: 'error'
    },
    completed: {
      title: 'Application Completed',
      message: `Your application ${applicationNumber} has been completed. You can now download your certificate.`,
      type: 'success'
    }
  };

  const notification = statusMessages[status];
  if (notification) {
    await sendNotification(
      userId,
      notification.title,
      notification.message,
      notification.type,
      applicationId
    );
  }
}

/**
 * Send registration approval notification
 * @param {string} email - User email
 * @param {string} firstName - User first name
 */
export async function notifyRegistrationApproved(userId, firstName) {
  await sendNotification(
    userId,
    'Account Approved',
    `Welcome ${firstName}! Your account has been approved. You can now login and submit applications.`,
    'success'
  );
}

/**
 * Send registration rejection notification
 * @param {string} email - User email
 * @param {string} reason - Rejection reason
 */
export async function notifyRegistrationRejected(email, reason) {
  // Note: This would need email service integration since user doesn't have account yet
  console.log(`Registration rejected for ${email}: ${reason}`);
}

export default {
  sendNotification,
  notifyApplicationStatusChange,
  notifyRegistrationApproved,
  notifyRegistrationRejected
};
