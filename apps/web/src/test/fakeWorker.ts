import { vi } from "vitest";

/**
 * Stand-in for the browser's Worker, which jsdom lacks. Records what the page posts
 * and lets the test answer, fail or crash it.
 */
export class FakeWorker {
  static instances: FakeWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly messages: unknown[] = [];
  terminated = false;

  constructor(
    readonly url: string | URL,
    readonly options?: WorkerOptions
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  /** Delivers a message from the worker to the page. */
  reply(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }

  /** Fires the worker's error event, as when it fails to load or throws. */
  crash(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

/** Replaces the global Worker with FakeWorker for the current test. */
export const installFakeWorker = () => {
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
  return FakeWorker;
};
