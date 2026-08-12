export type TicketStatus = 'OPEN' | 'PENDING' | 'IN_PROGRESS' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export type TicketCategory =
  | 'TECHNICAL_SUPPORT'
  | 'BUG_REPORT'
  | 'FEATURE_REQUEST'
  | 'BILLING'
  | 'ACCESS_REQUEST'
  | 'OTHER';

export type SlaStatus = 'ON_TRACK' | 'NEEDS_ATTENTION' | 'PAUSED' | 'BREACHED' | 'COMPLETED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SlaPolicy {
  id: string;
  organizationId: string;
  projectId?: string | null;
  name: string;
  description?: string | null;
  priority: Priority;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isBusinessHoursOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SlaTracker {
  id: string;
  ticketId: string;
  policyId?: string | null;
  status: SlaStatus;
  firstResponseDue?: string | null;
  firstResponseCompletedAt?: string | null;
  isFirstResponseBreached: boolean;
  resolutionDue?: string | null;
  resolutionCompletedAt?: string | null;
  isResolutionBreached: boolean;
  pausedAt?: string | null;
  totalPausedMinutes: number;
  createdAt: string;
  updatedAt: string;
  policy?: SlaPolicy | null;
}

export interface ServiceTicketComment {
  id: string;
  ticketId: string;
  authorId?: string | null;
  isInternal: boolean;
  content: string;
  createdAt: string;
  author?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface ServiceTicket {
  id: string;
  key: string;
  sequenceNumber: number;
  projectId: string;
  organizationId: string;
  title: string;
  description?: string | null;
  category: TicketCategory;
  status: TicketStatus;
  priority: Priority;
  requesterEmail: string;
  requesterName?: string | null;
  assigneeId?: string | null;
  linkedWorkItemId?: string | null;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    key: string;
    name: string;
  };
  assignee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  linkedWorkItem?: {
    id: string;
    key: string;
    title: string;
    status: string;
  } | null;
  slaTracker?: SlaTracker | null;
  comments?: ServiceTicketComment[];
}

export interface CreateTicketInput {
  projectId: string;
  title: string;
  description?: string;
  category: TicketCategory;
  priority?: Priority;
  requesterEmail: string;
  requesterName?: string;
}

export interface CreateSlaPolicyInput {
  projectId?: string;
  name: string;
  description?: string;
  priority: Priority;
  firstResponseTargetMinutes: number;
  resolutionTargetMinutes: number;
  isBusinessHoursOnly?: boolean;
}
