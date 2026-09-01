import type {
  PrinterInfo,
  SilentPrintPayload,
  SilentPrintResult,
} from "./lib/print";

declare global {
  interface Window {
    electron?: {
      isElectron: boolean;
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      on: (
        channel: string,
        callback: (event: unknown, ...args: unknown[]) => void,
      ) => void;
      send: (channel: string, ...args: unknown[]) => void;
      getPrinters: () => Promise<PrinterInfo[]>;
      printSilent: (payload: SilentPrintPayload) => Promise<SilentPrintResult>;
    };
  }
}

export {};
