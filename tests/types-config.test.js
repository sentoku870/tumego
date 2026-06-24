import { DEFAULT_CONFIG } from '../dist/types.js';

describe('DEFAULT_CONFIG', () => {
  describe('display constants', () => {
    test('COORD_LABEL_OFFSET_X is positive', () => {
      expect(DEFAULT_CONFIG.COORD_LABEL_OFFSET_X > 0).toBe(true);
    });

    test('COORD_LABEL_OFFSET_Y is positive', () => {
      expect(DEFAULT_CONFIG.COORD_LABEL_OFFSET_Y > 0).toBe(true);
    });
  });

  describe('responsive thresholds', () => {
    test('MOBILE_BREAKPOINT is a typical mobile width', () => {
      expect(DEFAULT_CONFIG.MOBILE_BREAKPOINT).toBe(768);
    });

    test('MOBILE_HORIZONTAL_RESERVED is less than DESKTOP_HORIZONTAL_RESERVED', () => {
      expect(
        DEFAULT_CONFIG.MOBILE_HORIZONTAL_RESERVED < DEFAULT_CONFIG.DESKTOP_HORIZONTAL_RESERVED
      ).toBe(true);
    });
  });

  describe('game constants', () => {
    test('STONE_RADIUS is smaller than CELL_SIZE / 2', () => {
      expect(DEFAULT_CONFIG.STONE_RADIUS < DEFAULT_CONFIG.CELL_SIZE / 2).toBe(true);
    });

    test('MIN_BOARD_SIZE <= DEFAULT_BOARD_SIZE <= MAX_BOARD_SIZE', () => {
      expect(DEFAULT_CONFIG.MIN_BOARD_SIZE <= DEFAULT_CONFIG.DEFAULT_BOARD_SIZE).toBe(true);
      expect(DEFAULT_CONFIG.DEFAULT_BOARD_SIZE <= DEFAULT_CONFIG.MAX_BOARD_SIZE).toBe(true);
    });
  });

  describe('QR thresholds', () => {
    test('QR_DATA thresholds are strictly increasing', () => {
      expect(DEFAULT_CONFIG.QR_DATA_SMALL < DEFAULT_CONFIG.QR_DATA_MEDIUM).toBe(true);
      expect(DEFAULT_CONFIG.QR_DATA_MEDIUM < DEFAULT_CONFIG.QR_DATA_LARGE).toBe(true);
    });

    test('QR image sizes follow WxH format', () => {
      const format = /^\d+x\d+$/;
      expect(format.test(DEFAULT_CONFIG.QR_IMAGE_SMALL)).toBe(true);
      expect(format.test(DEFAULT_CONFIG.QR_IMAGE_MEDIUM)).toBe(true);
      expect(format.test(DEFAULT_CONFIG.QR_IMAGE_LARGE)).toBe(true);
    });
  });

  describe('move number drawing', () => {
    test('MOVE_NUM ratios are positive', () => {
      expect(DEFAULT_CONFIG.MOVE_NUM_BG_RADIUS_RATIO > 0).toBe(true);
      expect(DEFAULT_CONFIG.MOVE_NUM_FONT_SCALE > 0).toBe(true);
      expect(DEFAULT_CONFIG.MOVE_NUM_STROKE_RATIO > 0).toBe(true);
      expect(DEFAULT_CONFIG.MOVE_NUM_BORDER_MARGIN > 0).toBe(true);
    });
  });

  describe('BOARD_CAPTURE_CSS_VARS', () => {
    test('includes the standard set of CSS variable names', () => {
      const expected = ['--board', '--line', '--star', '--coord', '--black', '--white'];
      for (const name of expected) {
        expect(DEFAULT_CONFIG.BOARD_CAPTURE_CSS_VARS).toContain(name);
      }
    });
  });
});
