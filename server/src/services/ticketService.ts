
import { PrismaClient, Ticket } from '@prisma/client';
import { IQueueAdapter, BullMQAdapter } from '../adapters';
import Redis from 'ioredis';
import { env } from '../config/env';

const prisma = new PrismaClient();
const queue: IQueueAdapter = new BullMQAdapter('ticket-processing', `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);

export class TicketService {
  constructor() {
    queue.connect();
  }

  async createTicket(content: string): Promise<Ticket> {
    // 1. Create DB Record
    const ticket = await prisma.ticket.create({
      data: {
        content,
        status: 'PENDING',
      },
    });

    // 2. Add to Queue
    await queue.addJob('process-ticket', { ticketId: ticket.id, content });

    // 3. Publish Event
    const redis = new Redis(`redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);
    await redis.publish('ticket-updates', JSON.stringify({ type: 'TICKET_CREATED', ticket: ticket }));
    await redis.quit();

    return ticket;
  }

  async getAllTickets(): Promise<Ticket[]> {
    return prisma.ticket.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicketById(id: string): Promise<Ticket | null> {
    return prisma.ticket.findUnique({
      where: { id },
    });
  }

  async resolveTicket(id: string, finalReply: string): Promise<Ticket> {
    return prisma.ticket.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        finalReply,
      },
    });
  }
}
