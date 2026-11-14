import { it, expect, vi } from "vitest";
vi.mock("@actions/core", () => ({ setFailed: vi.fn() }));
vi.mock("../../src/action.js", () => ({ run: vi.fn() }));
it("bundled entry wires cancellation and removes listeners after completion and failure", async () => {
  const { run } = await import("../../src/action.js");
  const core = await import("@actions/core");
  const handlers: (() => void)[] = [];
  const once = vi
    .spyOn(process, "once")
    .mockImplementation((_event, handler) => {
      handlers.push(handler);
      return process;
    });
  const remove = vi.spyOn(process, "removeListener");
  try {
    vi.mocked(run).mockImplementation(async (_core, _env, signal) => {
      handlers.at(-1)!();
      expect(signal?.aborted).toBe(true);
    });
    await import("../../src/index.js");
    await new Promise((resolve) => setImmediate(resolve));
    expect(remove).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    expect(remove).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
    vi.resetModules();
    const next = await import("../../src/action.js");
    vi.mocked(next.run).mockRejectedValueOnce(Error("internal"));
    await import("../../src/index.js");
    await new Promise((resolve) => setImmediate(resolve));
    expect(core.setFailed).toHaveBeenCalledWith(
      "CCv2 cleanup encountered an internal error.",
    );
  } finally {
    once.mockRestore();
    remove.mockRestore();
  }
});
