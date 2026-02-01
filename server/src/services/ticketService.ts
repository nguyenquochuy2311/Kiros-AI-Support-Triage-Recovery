
import { Ticket } from '@prisma/client';
import { prisma, env, redisPublisher } from '../config';
import { IQueueAdapter, BullMQAdapter } from '../adapters';

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

    // 2. Add to Queue with Retries
    await queue.addJob('process-ticket', { ticketId: ticket.id, content }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 }
    });

    // 3. Publish Event
    await redisPublisher.publish('ticket-updates', JSON.stringify({ type: 'TICKET_CREATED', ticket: ticket }));

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
