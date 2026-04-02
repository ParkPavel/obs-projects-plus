import {
  snapMinutes,
  snapTime,
  yPositionToMinutes,
  minutesToTime,
  minutesToRem,
  getSnapLines,
} from '../SnapEngine';

describe('SnapEngine', () => {
  describe('snapMinutes', () => {
    it('snaps to nearest 15-min interval', () => {
      expect(snapMinutes(7)).toBe(0);
      expect(snapMinutes(8)).toBe(15);
      expect(snapMinutes(14)).toBe(15);
      expect(snapMinutes(15)).toBe(15);
      expect(snapMinutes(22)).toBe(15);
      expect(snapMinutes(23)).toBe(30);
    });

    it('handles exact boundaries', () => {
      expect(snapMinutes(0)).toBe(0);
      expect(snapMinutes(60)).toBe(60);
      expect(snapMinutes(120)).toBe(120);
    });

    it('supports custom interval', () => {
      expect(snapMinutes(10, 30)).toBe(0);
      expect(snapMinutes(20, 30)).toBe(30);
      expect(snapMinutes(45, 60)).toBe(60);
    });

    it('returns raw value when interval is 0', () => {
      expect(snapMinutes(17, 0)).toBe(17);
    });
  });

  describe('snapTime', () => {
    it('snaps time string to nearest 15-min', () => {
      expect(snapTime('09:07')).toBe('09:00');
      expect(snapTime('09:08')).toBe('09:15');
      expect(snapTime('14:22')).toBe('14:15');
      expect(snapTime('14:23')).toBe('14:30');
    });

    it('handles hour boundaries', () => {
      expect(snapTime('09:53')).toBe('10:00');
      expect(snapTime('23:53')).toBe('23:45'); // clamped to 23:45
    });

    it('handles midnight', () => {
      expect(snapTime('00:00')).toBe('00:00');
    });

    it('supports 30-min interval', () => {
      expect(snapTime('10:10', 30)).toBe('10:00');
      expect(snapTime('10:20', 30)).toBe('10:30');
    });
  });

  describe('yPositionToMinutes', () => {
    // Timeline: 0-24h, hourHeightRem=3, remPx=16
    // Total height = 24 * 3 * 16 = 1152px
    const startHour = 0;
    const endHour = 24;
    const hourHeightRem = 3;
    const remPx = 16;

    it('converts top of timeline to 0 minutes', () => {
      expect(yPositionToMinutes(0, startHour, endHour, hourHeightRem, remPx)).toBe(0);
    });

    it('converts pixel position to snapped minutes', () => {
      // 1 hour = 3rem * 16px = 48px
      // 9:00 = 9 * 48 = 432px
      const result = yPositionToMinutes(432, 0, 24, 3, 16);
      expect(result).toBe(540); // 9 * 60 = 540
    });

    it('snaps to 15-min grid', () => {
      // ~9:10 → should snap to 9:15 (555 min)
      const px910 = (9 + 10 / 60) * 48; // 9.167 * 48 = 440
      const result = yPositionToMinutes(px910, 0, 24, 3, 16);
      expect(result).toBe(555); // 9:15
    });

    it('clamps to visible range', () => {
      expect(yPositionToMinutes(-100, 0, 24, 3, 16)).toBe(0);
      expect(yPositionToMinutes(9999, 0, 24, 3, 16)).toBe(1440); // 24:00
    });

    it('works with partial day range (8-20)', () => {
      // 8-20h = 12h, totalHeight = 12 * 48 = 576px
      // Top of range (0px) = 8:00 = 480 min
      expect(yPositionToMinutes(0, 8, 20, 3, 16)).toBe(480);
    });
  });

  describe('minutesToTime', () => {
    it('formats minutes correctly', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(540)).toBe('09:00');
      expect(minutesToTime(1425)).toBe('23:45');
    });

    it('clamps to valid range', () => {
      expect(minutesToTime(-10)).toBe('00:00');
    });
  });

  describe('minutesToRem', () => {
    it('converts minutes to rem position', () => {
      // 9:00 (540 min) with startHour=0, hourHeightRem=3
      // = (540 - 0) * (3/60) = 540 * 0.05 = 27rem
      expect(minutesToRem(540, 0, 3)).toBe(27);
    });

    it('accounts for startHour offset', () => {
      // 9:00 (540 min) with startHour=8 (480 min offset)
      // = (540 - 480) * (3/60) = 60 * 0.05 = 3rem
      expect(minutesToRem(540, 8, 3)).toBe(3);
    });

    it('returns 0 for start of range', () => {
      expect(minutesToRem(0, 0, 3)).toBe(0);
      expect(minutesToRem(480, 8, 3)).toBe(0);
    });
  });

  describe('getSnapLines', () => {
    it('generates lines for given range', () => {
      const lines = getSnapLines(9, 10, 15, 3);
      expect(lines).toHaveLength(5); // 9:00, 9:15, 9:30, 9:45, 10:00
      expect(lines[0]?.time).toBe('09:00');
      expect(lines[0]?.type).toBe('major');
      expect(lines[1]?.time).toBe('09:15');
      expect(lines[1]?.type).toBe('minor');
      expect(lines[4]?.time).toBe('10:00');
      expect(lines[4]?.type).toBe('major');
    });

    it('calculates correct rem positions', () => {
      const lines = getSnapLines(0, 1, 15, 3);
      // 0:00 → 0rem, 0:15 → 0.75rem, 0:30 → 1.5rem, 0:45 → 2.25rem, 1:00 → 3rem
      expect(lines[0]?.positionRem).toBe(0);
      expect(lines[1]?.positionRem).toBeCloseTo(0.75);
      expect(lines[2]?.positionRem).toBeCloseTo(1.5);
      expect(lines[3]?.positionRem).toBeCloseTo(2.25);
      expect(lines[4]?.positionRem).toBe(3);
    });

    it('supports 30-min interval', () => {
      const lines = getSnapLines(9, 11, 30, 3);
      expect(lines).toHaveLength(5); // 9:00, 9:30, 10:00, 10:30, 11:00
    });
  });
});
