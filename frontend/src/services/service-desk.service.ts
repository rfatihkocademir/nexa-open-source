import { api } from './api';
import type {
  ServiceTicket,
  SlaPolicy,
  CreateTicketInput,
  CreateSlaPolicyInput,
  TicketStatus,
  TicketCategory,
  Priority,
  ServiceTicketComment,
} from '../types/service-desk';

const unwrap = <T>(response: unknown): T => {
  if (response && typeof response === 'object' && 'data' in response) return (response as { data: T }).data;
  return response as T;
};

export const serviceDeskService = {
  async getTickets(params?: {
    projectId?: string;
    status?: TicketStatus;
    category?: TicketCategory;
    assigneeId?: string;
    search?: string;
  }): Promise<ServiceTicket[]> {
    const response = await api.get('/service-desk/tickets', { params });
    return unwrap<ServiceTicket[]>(response);
  },

  async getTicket(id: string): Promise<ServiceTicket> {
    const response = await api.get(`/service-desk/tickets/${id}`);
    return unwrap<ServiceTicket>(response);
  },

  async createTicket(input: CreateTicketInput): Promise<ServiceTicket> {
    const response = await api.post('/service-desk/tickets', input);
    return unwrap<ServiceTicket>(response);
  },

  async updateTicket(
    id: string,
    data: { status?: TicketStatus; assigneeId?: string | null; priority?: Priority; category?: TicketCategory }
  ): Promise<ServiceTicket> {
    const response = await api.patch(`/service-desk/tickets/${id}`, data);
    return unwrap<ServiceTicket>(response);
  },

  async addComment(ticketId: string, content: string, isInternal = false): Promise<ServiceTicketComment> {
    const response = await api.post(`/service-desk/tickets/${ticketId}/comments`, { content, isInternal });
    return unwrap<ServiceTicketComment>(response);
  },

  async convertToWorkItem(ticketId: string, targetType: 'BUG' | 'TASK' | 'STORY' = 'BUG') {
    const response = await api.post(`/service-desk/tickets/${ticketId}/convert`, { targetType });
    return unwrap<{ key: string }>(response);
  },

  async getSlaPolicies(projectId?: string): Promise<SlaPolicy[]> {
    const response = await api.get('/service-desk/sla-policies', { params: { projectId } });
    return unwrap<SlaPolicy[]>(response);
  },

  async createSlaPolicy(input: CreateSlaPolicyInput): Promise<SlaPolicy> {
    const response = await api.post('/service-desk/sla-policies', input);
    return unwrap<SlaPolicy>(response);
  },

  async rateTicket(ticketId: string, rating: number, comment?: string) {
    const response = await api.post(`/service-desk/tickets/${ticketId}/rate`, { rating, comment });
    return unwrap(response);
  },

  async getAnalytics(projectId?: string): Promise<{
    totalTickets: number;
    openTickets: number;
    resolvedTickets: number;
    breachedCount: number;
    slaComplianceRate: number;
    csatScore: number;
    ratedTicketCount: number;
  }> {
    const response = await api.get('/service-desk/analytics', { params: { projectId } });
    return unwrap(response);
  },
};
