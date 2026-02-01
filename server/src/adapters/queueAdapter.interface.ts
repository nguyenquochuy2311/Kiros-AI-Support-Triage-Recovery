
export interface IQueueAdapter {
  connect(): Promise<void>;
  addJob(name: string, data: unknown, options?: { attempts?: number; backoff?: { type: string; delay: number } }): Promise<void>;
  process(name: string, handler: (job: any) => Promise<void>): void;
  close(): Promise<void>;
}
