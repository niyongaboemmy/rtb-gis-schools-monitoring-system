import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIdleTimeout } from "./useIdleTimeout";

describe("useIdleTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("warns before the timeout, then signs out", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useIdleTimeout({ timeoutMs: 10_000, warningMs: 4_000, onTimeout }),
    );

    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.warning).toBe(false);

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current.warning).toBe(true);
    expect(onTimeout).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(4_000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("'Stay signed in' resets the timer", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useIdleTimeout({ timeoutMs: 10_000, warningMs: 4_000, onTimeout }),
    );
    act(() => vi.advanceTimersByTime(7_000));
    expect(result.current.warning).toBe(true);

    act(() => result.current.stayActive());
    expect(result.current.warning).toBe(false);
    act(() => vi.advanceTimersByTime(7_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("user activity postpones the warning", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() =>
      useIdleTimeout({ timeoutMs: 10_000, warningMs: 4_000, onTimeout }),
    );
    act(() => vi.advanceTimersByTime(5_000));
    act(() => {
      window.dispatchEvent(new Event("keydown"));
    });
    act(() => vi.advanceTimersByTime(5_000));
    expect(result.current.warning).toBe(false);
  });

  it("does nothing when disabled", () => {
    const onTimeout = vi.fn();
    renderHook(() => useIdleTimeout({ timeoutMs: 1_000, warningMs: 500, onTimeout, enabled: false }));
    act(() => vi.advanceTimersByTime(5_000));
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
