
import { Response } from 'express';
import Redis from 'ioredis';
import { env } from '../config/env';

class SSEManager {
  private clients: Set<Response> = new Set();
  private redisSubscriber: Redis;

  constructor() {
    this.redisSubscriber = new Redis(`redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);

    this.redisSubscriber.subscribe('ticket-updates', (err) => {
      if (err) console.error('Failed to subscribe to ticket-updates:', err);
      else console.log('Subscribed to ticket-updates channel');
    });

    this.redisSubscriber.on('message', (channel, message) => {
      if (channel === 'ticket-updates') {
        this.broadcast(JSON.parse(message));
      }
    });
  }

  addClient(res: Response) {
    this.clients.add(res);
    res.on('close', () => {
      this.clients.delete(res);
      res.end();
    });
  }

  private broadcast(data: any) {
    this.clients.forEach(client => {
      client.write(`data: ${JSON.stringify(data)}\n\n`);
    });
  }
}

export const sseManager = new SSEManager();
