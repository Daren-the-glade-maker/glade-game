import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import ZeldaGame3D from "../components/ZeldaGame3D";

const mocks = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    dispose: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  }>,
  fail: false,
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class MockRenderer {
    domElement = document.createElement("canvas");
    shadowMap = { enabled: false, type: 0, needsUpdate: false };
    setPixelRatio = vi.fn();
    setSize = vi.fn();
    setClearColor = vi.fn();
    render = vi.fn();
    dispose = vi.fn();
    constructor() {
      if (mocks.fail) throw new Error("WebGL unavailable");
      mocks.renderers.push(this);
    }
  }
  return { ...actual, WebGLRenderer: MockRenderer };
});

let callbacks: Map<number, FrameRequestCallback>;
let nextFrame: number;
function frame() {
  const pending = [...callbacks.values()];
  callbacks.clear();
  act(() => pending.forEach((callback) => callback(performance.now())));
}

beforeEach(() => {
  mocks.renderers.length = 0;
  mocks.fail = false;
  callbacks = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callbacks.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => callbacks.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("game lifecycle", () => {
  it("mounts, renders, changes quality and disposes on unmount, including StrictMode", () => {
    const view = render(
      <StrictMode>
        <ZeldaGame3D />
      </StrictMode>,
    );
    expect(mocks.renderers).toHaveLength(2);
    expect(mocks.renderers[0].dispose).toHaveBeenCalledOnce();
    expect(screen.getByRole("application")).toBeTruthy();
    frame();
    const renderer = mocks.renderers[1];
    expect(renderer.render).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "HQ" }));
    expect(renderer.setPixelRatio).toHaveBeenLastCalledWith(1);
    view.unmount();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(callbacks.size).toBe(0);
  });

  it("clears held movement when the window loses focus", () => {
    let time = 100;
    const now = vi.spyOn(performance, "now").mockImplementation(() => time);
    render(<ZeldaGame3D />);
    frame();
    const renderer = mocks.renderers[0];
    const scene = renderer.render.mock.calls[0][0] as import("three").Scene;
    const hero = scene.children.find(
      (object) => object.position.z === 25 && object.children.length > 10,
    );
    expect(hero).toBeDefined();
    const initialZ = hero!.position.z;
    fireEvent.keyDown(window, { key: "w" });
    time += 30;
    frame();
    expect(hero!.position.z).not.toBe(initialZ);
    fireEvent.blur(window);
    const stoppedZ = hero!.position.z;
    time += 30;
    frame();
    expect(hero!.position.z).toBe(stoppedZ);
    now.mockRestore();
  });

  it("shows a useful WebGL failure instead of crashing", () => {
    mocks.fail = true;
    render(<ZeldaGame3D />);
    expect(screen.getByRole("alert").textContent).toContain("WebGL is not available");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("offers labelled touch actions and does not capture input fields", () => {
    render(<ZeldaGame3D />);
    expect(screen.getByRole("button", { name: "Dragon fire" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Flap" })).toBeTruthy();
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = new KeyboardEvent("keydown", { key: "w", bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    input.remove();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Move up" }));
    fireEvent.pointerCancel(screen.getByRole("button", { name: "Move up" }));
    frame();
  });
});
