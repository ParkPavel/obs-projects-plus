import {
  hapticTapCreate,
  hapticDragStart,
  hapticSnap,
  hapticDrop,
  hapticResizeLimit,
  hapticCancel,
  hapticCreationConfirm,
  setHapticEnabled,
} from '../HapticManager';

describe('HapticManager', () => {
  let vibrateMock: jest.Mock;

  beforeEach(() => {
    vibrateMock = jest.fn();
    Object.defineProperty(navigator, 'vibrate', {
      value: vibrateMock,
      writable: true,
      configurable: true,
    });
    // Reset to enabled before each test
    setHapticEnabled(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('hapticTapCreate vibrates 30ms', () => {
    hapticTapCreate();
    expect(vibrateMock).toHaveBeenCalledWith([30]);
  });

  it('hapticDragStart vibrates 50ms', () => {
    hapticDragStart();
    expect(vibrateMock).toHaveBeenCalledWith([50]);
  });

  it('hapticSnap vibrates 15ms', () => {
    hapticSnap();
    expect(vibrateMock).toHaveBeenCalledWith([15]);
  });

  it('hapticDrop vibrates 40ms', () => {
    hapticDrop();
    expect(vibrateMock).toHaveBeenCalledWith([40]);
  });

  it('hapticResizeLimit vibrates with pattern', () => {
    hapticResizeLimit();
    expect(vibrateMock).toHaveBeenCalledWith([20, 50, 20]);
  });

  it('hapticCancel vibrates with pattern', () => {
    hapticCancel();
    expect(vibrateMock).toHaveBeenCalledWith([15, 30, 15]);
  });

  it('hapticCreationConfirm vibrates with pattern', () => {
    hapticCreationConfirm();
    expect(vibrateMock).toHaveBeenCalledWith([20, 40]);
  });

  it('does not throw when vibrate is not available', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: undefined,
      writable: true,
      configurable: true,
    });
    expect(() => hapticDragStart()).not.toThrow();
  });

  it('setHapticEnabled(false) disables all vibrations', () => {
    setHapticEnabled(false);
    hapticDragStart();
    hapticSnap();
    hapticDrop();
    expect(vibrateMock).not.toHaveBeenCalled();
  });

  it('setHapticEnabled(true) re-enables vibrations', () => {
    setHapticEnabled(false);
    hapticDragStart();
    expect(vibrateMock).not.toHaveBeenCalled();
    setHapticEnabled(true);
    hapticDragStart();
    expect(vibrateMock).toHaveBeenCalledWith([50]);
  });
});
