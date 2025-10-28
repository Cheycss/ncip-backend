import cron from 'node-cron';
import { autoCancelOverdueApplications, sendDeadlineWarnings } from './autoCancelApplications.js';

/**
 * Initialize all scheduled jobs
 */
export function initializeScheduler() {
  console.log('📅 Initializing job scheduler...');

  // Run auto-cancellation every day at midnight (00:00)
  cron.schedule('0 0 * * *', async () => {
    console.log('\n🕐 Running scheduled job: Auto-cancel overdue applications');
    try {
      const result = await autoCancelOverdueApplications();
      console.log('✅ Auto-cancellation job completed:', result);
    } catch (error) {
      console.error('❌ Auto-cancellation job failed:', error);
    }
  });

  // Run deadline warnings every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    console.log('\n🕐 Running scheduled job: Send deadline warnings');
    try {
      const result = await sendDeadlineWarnings();
      console.log('✅ Deadline warnings job completed:', result);
    } catch (error) {
      console.error('❌ Deadline warnings job failed:', error);
    }
  });

  // Optional: Run a check every hour for very urgent cases (1 day remaining)
  cron.schedule('0 * * * *', async () => {
    console.log('\n🕐 Running hourly check: Urgent deadline warnings');
    try {
      const result = await sendDeadlineWarnings();
      if (result.sent > 0) {
        console.log('✅ Urgent warnings sent:', result);
      }
    } catch (error) {
      console.error('❌ Urgent warnings job failed:', error);
    }
  });

  console.log('✅ Scheduler initialized successfully');
  console.log('📋 Scheduled jobs:');
  console.log('   - Auto-cancel overdue applications: Daily at 00:00');
  console.log('   - Send deadline warnings: Daily at 09:00');
  console.log('   - Urgent deadline check: Every hour');
}

export default initializeScheduler;
