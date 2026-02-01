import { Queue, Worker, QueueEvents } from 'bullmq';
import { IQueueAdapter } from './queueAdapter.interface';
import Redis from 'ioredis';

export class BullMQAdapter implements IQueueAdapter {
  private queue: Queue;
  private worker?: Worker;
  private queueEvents: QueueEvents;
  private redisConnection: Redis;

  constructor(queueName: string, redisUrl: string) {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    this.redisConnection = connection;

    this.queue = new Queue(queueName, { connection });
    this.queueEvents = new QueueEvents(queueName, { connection });
  }

  async connect(): Promise<void> {
    // BullMQ connects automatically
    console.log('BullMQ Adapter connected');
  }

  async addJob(name: string, data: unknown, options?: { attempts?: number; backoff?: { type: string; delay: number } }): Promise<void> {
    await this.queue.add(name, data, {
      attempts: options?.attempts || 3,
      backoff: options?.backoff || {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  process(name: string, handler: (job: any) => Promise<void>): void {
    this.worker = new Worker(this.queue.name, async (job) => {
      await handler(job);
    }, { connection: this.redisConnection });

    this.worker.on('completed', (job) => {
      console.log(`Job ${job.id} completed!`);
    });

    this.worker.on('failed', (job, err) => {
      console.log(`Job ${job?.id} failed!`, err);
    });
  }

  async close(): Promise<void> {
    await this.queue.close();
    if (this.worker) {
      await this.worker.close();
    }
    await this.queueEvents.close();
    await this.redisConnection.quit();
  }
}
