import type { ReportContext, ReportStatus, SafetyReport } from '../types/safety';
export type { ReportContext, ReportStatus, SafetyReport };

export {
  reportUser,
  fetchReportsForAdmin,
  updateReportStatus,
} from './accountSafety';

/** @deprecated Use reportUser from accountSafety */
export async function createReport(input: {
  reporterId: string;
  reportedId: string;
  context: ReportContext;
  speedDateId?: string;
  notes?: string;
}): Promise<void> {
  const { reportUser } = await import('./accountSafety');
  await reportUser({
    reporterId: input.reporterId,
    reportedUserId: input.reportedId,
    context: input.context,
    speedDateId: input.speedDateId,
    notes: input.notes,
  });
}
