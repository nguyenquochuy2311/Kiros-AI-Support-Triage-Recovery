
import { PrismaClient } from '@prisma/client';
import { BullMQAdapter } from '../adapters';
import OpenAI from 'openai';
import Redis from 'ioredis';
import { z } from 'zod';
import { env } from '../config/env';

const prisma = new PrismaClient();
const queue = new BullMQAdapter('ticket-processing', `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);

// Mock LLM or Real OpenAI
const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const llmResponseSchema = z.object({
  category: z.enum(["Billing", "Technical", "Featue", "Other"]), // Intentionally misspelled Feature to match potential AI output, or use strict
  urgency: z.enum(["High", "Medium", "Low"]),
  sentiment: z.number().int().min(1).max(10),
  draftReply: z.string(),
});

type LLMResponse = z.infer<typeof llmResponseSchema>;

const processTicket = async (job: any) => {
  const { ticketId, content } = job.data;
  console.log(`Processing ticket ${ticketId}...`);

  try {
    // 1. Fetch Ticket
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    // 4.1 Step 1: Analyze (JSON) - Classification & Sentiment
    const analysisCompletion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful support agent. Analyze the ticket and return JSON." },
        { role: "user", content: `Analyze this: ${content}. Return JSON matching: { category: 'Billing'|'Technical'|'Feature'|'Other', urgency: 'High'|'Medium'|'Low', sentiment: 1-10 }` }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    });
    const analysisRaw = analysisCompletion.choices[0].message.content || "{}";
    const analysisFields = JSON.parse(analysisRaw);

    // Update DB with Classification
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        category: analysisFields.category,
        urgency: analysisFields.urgency,
        sentiment: typeof analysisFields.sentiment === 'string' ? parseInt(analysisFields.sentiment, 10) : analysisFields.sentiment,
      }
    });

    // Notify Frontend of Classification
    const redis = new Redis(`redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);
    await redis.publish('ticket-updates', JSON.stringify({
      type: 'TICKET_UPDATED',
      ticketId,
      category: analysisFields.category,
      urgency: analysisFields.urgency,
      sentiment: analysisFields.sentiment
    }));

    // 4.2 Step 2: Draft Reply (Streaming)
    const stream = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful support agent. Draft a reply to the user." },
        { role: "user", content: `Ticket content: ${content}. Analysis: ${JSON.stringify(analysisFields)}. Draft a polite reply.` }
      ],
      model: "gpt-3.5-turbo",
      stream: true,
    });

    let fullReply = "";

    // Notify Frontend that drafting started
    await redis.publish('ticket-updates', JSON.stringify({
      type: 'TICKET_UPDATED',
      ticketId,
      status: 'PROCESSED', // Or 'DRAFTING' if we had that state, but PROCESSED triggers the UI to show textarea
      draftReply: ""
    }));

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullReply += delta;
        await redis.publish('ticket-updates', JSON.stringify({
          type: 'TICKET_PARTIAL',
          ticketId,
          delta
        }));
      }
    }

    // 5. Final Update DB
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'PROCESSED',
        draftReply: fullReply,
      }
    });

    // Final Event to ensure consistency
    await redis.publish('ticket-updates', JSON.stringify({ type: 'TICKET_UPDATED', ticketId, draftReply: fullReply, status: 'PROCESSED' }));
    await redis.quit();

    console.log(`Ticket ${ticketId} processed successfully.`);

  } catch (error) {
    console.error(`Failed to process ticket ${ticketId}:`, error);
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'FAILED' }
    });
  }
};

// Start Worker
queue.process('process-ticket', processTicket);

console.log('Worker started...');
