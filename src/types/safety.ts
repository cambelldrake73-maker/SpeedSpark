export type AccountStatus = 'active' | 'suspended' | 'deleted_request' | 'deleted';

export type ReportContext = 'call' | 'messages' | 'profile';

export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'action_taken';

export interface SafetyReport {
  id: string;
  reporterId: string;
  reportedId: string;
  context: ReportContext;
  speedDateId: string | null;
  notes: string | null;
  status: ReportStatus;
  adminNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockUserOptions {
  speedDateId?: string;
}
