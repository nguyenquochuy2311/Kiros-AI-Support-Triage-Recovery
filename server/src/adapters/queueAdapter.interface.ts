
export interface IQueueAdapter {
  connect(): Promise<void>;
  addJob(name: string, data: unknown): Promise<void>;
  process(name: string, handler: (job: any) => Promise<void>): void;
  close(): Promise<void>;
}
