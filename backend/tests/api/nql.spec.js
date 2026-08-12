const path = require('node:path');
const { test, expect } = require('@playwright/test');

const { nqlService } = require(path.join(__dirname, '../../dist/services/nql.service.js'));

test.describe('NQL compiler', () => {
  test('compiles familiar filters without raw SQL', () => {
    const result = nqlService.compile(
      'type IN (BUG, DEFECT) AND priority = CRITICAL AND assignee = currentUser() ORDER BY updated DESC',
      'user-42',
    );
    expect(result.where.AND).toEqual([
      { itemType: { in: ['BUG', 'DEFECT'] } },
      { priority: 'CRITICAL' },
      { assigneeId: 'user-42' },
    ]);
    expect(result.orderBy).toEqual([{ updatedAt: 'desc' }]);
  });

  test('supports custom fields, empty values and numeric comparisons', () => {
    const result = nqlService.compile(
      'custom.CUSTOMER_IMPACT = HIGH AND sprint IS EMPTY AND points >= 5',
      'user-42',
    );
    expect(result.where.AND[0]).toEqual({ customFields: { path: ['CUSTOMER_IMPACT'], equals: 'HIGH' } });
    expect(result.where.AND[2]).toEqual({ storyPoints: { gte: 5 } });
  });

  test('rejects unknown fields and excessive query complexity', () => {
    expect(() => nqlService.compile('password = secret', 'user-42')).toThrow(/Unknown NQL field/);
    expect(() => nqlService.compile(Array.from({ length: 31 }, () => 'status = TODO').join(' AND '), 'user-42')).toThrow(/at most 30/);
  });

  test('supports OR, full text and relative dates', () => {
    const result = nqlService.compile('type = BUG OR type = DEFECT AND text ~ "payment" AND updated >= -7d', 'user-42');
    expect(result.where.AND[0]).toEqual({ OR: [{ itemType: 'BUG' }, { itemType: 'DEFECT' }] });
    expect(result.where.AND[1].OR).toHaveLength(3);
    expect(result.where.AND[2].updatedAt.gte).toBeInstanceOf(Date);
  });
});
