import { test, expect } from '@playwright/test';
import { ServiceDeskService } from '../../src/services/service-desk.service';

const service = new ServiceDeskService();

test.describe('Service Desk & SLA Engine Unit / Integration', () => {
  test('rejects incomplete tickets before any persistence attempt', async () => {
    await expect(service.createTicket({
      organizationId: 'org',
      projectId: '',
      title: '',
      category: 'TECHNICAL_SUPPORT',
      requesterEmail: '',
    })).rejects.toThrow('Proje, başlık ve talep eden e-posta alanları zorunludur.');
  });

  test('enforces Service Desk roles and SLA target validation', async () => {
    await expect(service.convertToWorkItem('ticket', 'org', 'BUG', 'user', 'TESTER'))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(service.createSlaPolicy({
      organizationId: 'org',
      name: '',
      priority: 'MEDIUM',
      firstResponseTargetMinutes: 0,
      resolutionTargetMinutes: 0,
    }, 'SERVICE_DESK_AGENT')).rejects.toMatchObject({ statusCode: 400 });
  });
});
