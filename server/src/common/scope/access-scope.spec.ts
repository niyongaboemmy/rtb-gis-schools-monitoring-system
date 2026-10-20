import {
  resolveAccessScope,
  schoolMatchesScope,
  applySchoolScope,
  scopeLabel,
} from './access-scope';

const withFlag = (on: boolean, fn: () => void) => {
  const prev = process.env.SCOPE_ENFORCEMENT;
  process.env.SCOPE_ENFORCEMENT = on ? 'true' : 'false';
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.SCOPE_ENFORCEMENT;
    else process.env.SCOPE_ENFORCEMENT = prev;
  }
};

const user = (levelSlug: string | null, rank: number, location: any = {}) => ({
  role: {
    name: 'officer',
    accessLevel: levelSlug ? { name: levelSlug, slug: levelSlug, rank } : null,
  },
  location,
});

describe('resolveAccessScope', () => {
  it('is national + unenforced when the flag is off', () => {
    withFlag(false, () => {
      const s = resolveAccessScope(user('district', 30, { province: 'X' }));
      expect(s.enforced).toBe(false);
      expect(s.isNational).toBe(true);
    });
  });

  it('binds a province officer to their province when enforced', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(
        user('province', 20, { province: 'Northern Province' }),
      );
      expect(s.enforced).toBe(true);
      expect(s.isNational).toBe(false);
      expect(s.slug).toBe('province');
      expect(s.province).toBe('Northern Province');
    });
  });

  it('keeps super_admin national even with a narrow configured level', () => {
    withFlag(true, () => {
      const su = user('school', 50, { schoolId: 'abc' });
      su.role.name = 'super_admin';
      const s = resolveAccessScope(su);
      expect(s.isNational).toBe(true);
    });
  });

  it('treats an unconfigured access level as national (safe default)', () => {
    withFlag(true, () => {
      expect(resolveAccessScope(user(null, 100)).isNational).toBe(true);
    });
  });
});

describe('schoolMatchesScope', () => {
  const school = {
    id: 's1',
    province: 'Northern Province',
    district: 'Musanze',
    sector: 'Muhoza',
  };

  it('passes everything when national', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(user('national', 10));
      expect(schoolMatchesScope(school, s)).toBe(true);
    });
  });

  it('matches within province, rejects outside', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(
        user('province', 20, { province: 'Northern Province' }),
      );
      expect(schoolMatchesScope(school, s)).toBe(true);
      expect(
        schoolMatchesScope({ ...school, province: 'Kigali City' }, s),
      ).toBe(false);
    });
  });

  it('matches district prefix', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(
        user('district', 30, {
          province: 'Northern Province',
          district: 'Musanze',
        }),
      );
      expect(schoolMatchesScope(school, s)).toBe(true);
      expect(schoolMatchesScope({ ...school, district: 'Burera' }, s)).toBe(
        false,
      );
    });
  });

  it('school tier matches only the bound school id', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(user('school', 50, { schoolId: 's1' }));
      expect(schoolMatchesScope(school, s)).toBe(true);
      expect(schoolMatchesScope({ ...school, id: 's2' }, s)).toBe(false);
    });
  });

  it('rejects when the bound node is missing', () => {
    withFlag(true, () => {
      const s = resolveAccessScope(user('province', 20, {}));
      expect(schoolMatchesScope(school, s)).toBe(false);
    });
  });
});

describe('applySchoolScope', () => {
  const makeQb = () => {
    const calls: Array<[string, any]> = [];
    const qb: any = {
      andWhere: (clause: string, params: any) => {
        calls.push([clause, params]);
        return qb;
      },
      calls,
    };
    return qb;
  };

  it('is a no-op when national', () => {
    withFlag(true, () => {
      const qb = makeQb();
      applySchoolScope(qb, resolveAccessScope(user('national', 10)));
      expect(qb.calls).toHaveLength(0);
    });
  });

  it('adds province + district predicates for a district officer', () => {
    withFlag(true, () => {
      const qb = makeQb();
      applySchoolScope(
        qb,
        resolveAccessScope(
          user('district', 30, { province: 'P', district: 'D' }),
        ),
        'school',
      );
      expect(qb.calls).toHaveLength(2);
      expect(qb.calls[0][0]).toContain('school.province');
      expect(qb.calls[1][0]).toContain('school.district');
    });
  });

  it('uses a valid nil-UUID sentinel when a binding is missing (no SQL uuid error)', () => {
    withFlag(true, () => {
      const qb = makeQb();
      applySchoolScope(
        qb,
        resolveAccessScope(user('school', 50, {})), // school tier, no schoolId
        'school',
      );
      expect(qb.calls[0][1].scopeSchoolId).toBe(
        '00000000-0000-0000-0000-000000000000',
      );
    });
  });
});

describe('scopeLabel', () => {
  it('renders a readable node label', () => {
    withFlag(true, () => {
      expect(
        scopeLabel(
          resolveAccessScope(user('district', 30, { district: 'Musanze' })),
        ),
      ).toBe('Musanze District');
      expect(scopeLabel(resolveAccessScope(user('national', 10)))).toBe(
        'National',
      );
    });
  });
});
