
import { Request, Response } from 'express';
import { TicketService } from '../services/ticketService';
import { z } from 'zod';

const ticketService = new TicketService();

const createTicketSchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters long").max(2000),
});

export const createTicket = async (req: Request, res: Response) => {
  try {
    const { content } = createTicketSchema.parse(req.body);
    const ticket = await ticketService.createTicket(content);
    res.status(201).json(ticket);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors });
    } else {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
};

export const getTickets = async (req: Request, res: Response) => {
  try {
    const tickets = await ticketService.getAllTickets();
    res.json(tickets);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ticket = await ticketService.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const resolveTicket = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { finalReply } = req.body;

    if (!finalReply) {
      return res.status(400).json({ error: 'Final reply is required' });
    }

    const ticket = await ticketService.resolveTicket(id, finalReply);
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
