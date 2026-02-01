
import { BullMQAdapter } from '../adapters';
import OpenAI from 'openai';
import { z } from 'zod';
import { env, prisma, redisPublisher } from '../config';

const queue = new BullMQAdapter('ticket-processing', `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`);

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
});

const AnalysisSchema = z.object({
  category: z.preprocess((val) => {
    if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
    return val;
  }, z.enum(["Billing", "Technical", "Feature", "Other"]).nullable().optional()),
  urgency: z.preprocess((val) => {
    if (Array.isArray(val)) return val.length > 0 ? val[0] : null;
    return val;
  }, z.enum(["High", "Medium", "Low"]).nullable().optional()),
  sentiment: z.preprocess((val) => parseInt(String(val), 10), z.number().int().min(1).max(10)).optional(),
});

// Retry helper
const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      console.warn(`Retry ${i + 1}/${retries} failed:`, error);
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
  }
  throw lastError;
};

const processTicket = async (job: any) => {
  const { ticketId, content } = job.data;
  console.log(`Processing ticket ${ticketId}...`);

  try {
    // 1. Fetch Ticket
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new Error('Ticket not found');

    // 4.1 Step 1: Analyze (JSON) - Classification & Sentiment
    const analysisCompletion = await withRetry(async () => await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful support agent. Analyze the ticket and return JSON." },
        { role: "user", content: `Analyze this: ${content}. Return JSON matching: { category: 'Billing'|'Technical'|'Feature'|'Other' (choose one), urgency: 'High'|'Medium'|'Low', sentiment: 1-10 }` }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
    }));

    const analysisRaw = analysisCompletion.choices[0].message.content || "{}";
    let analysisJson;
    try {
      analysisJson = JSON.parse(analysisRaw);
    } catch (e) {
      console.error("Failed to parse JSON analysis, using default", e);
      analysisJson = { category: "Other", urgency: "Medium", sentiment: 5 };
    }

    // Validate with safe parse to avoid throwing if partial data
    const analysisResult = AnalysisSchema.safeParse(analysisJson);
    const analysisFields = analysisResult.success ? analysisResult.data : { category: "Other", urgency: "Medium", sentiment: 5 };

    if (!analysisResult.success) {
      console.warn("Analysis schema validation failed, using fallback:", analysisResult.error);
    }


    // Update DB with Classification
    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        category: analysisFields.category as any, // Cast if necessary or fix schema type
        urgency: analysisFields.urgency as any,
        sentiment: analysisFields.sentiment,
      }
    });

    // Notify Frontend of Classification
    await redisPublisher.publish('ticket-updates', JSON.stringify({
      type: 'TICKET_UPDATED',
      ticketId,
      category: analysisFields.category,
      urgency: analysisFields.urgency,
      sentiment: analysisFields.sentiment
    }));

    // 4.2 Step 2: Draft Reply (Streaming)
    const stream = await withRetry(async () => await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful support agent. Draft a reply to the user." },
        { role: "user", content: `Ticket content: ${content}. Analysis: ${JSON.stringify(analysisFields)}. Draft a polite reply.` }
      ],
      model: "gpt-3.5-turbo",
      stream: true,
    }));

    let fullReply = "";

    // Notify Frontend that drafting started
    await redisPublisher.publish('ticket-updates', JSON.stringify({
      type: 'TICKET_UPDATED',
      ticketId,
      status: 'PROCESSED',
      draftReply: ""
    }));

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || "";
      if (delta) {
        fullReply += delta;
        await redisPublisher.publish('ticket-updates', JSON.stringify({
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

    // Final is redundantly published via the stream loop's final state or we can send one last finalized event
    await redisPublisher.publish('ticket-updates', JSON.stringify({ type: 'TICKET_UPDATED', ticketId, draftReply: fullReply, status: 'PROCESSED' }));

    console.log(`Ticket ${ticketId} processed successfully.`);

  } catch (error: any) {
    console.error(`Failed to process ticket ${ticketId}:`, error);

    const errorData = {
      message: error.message || 'Unknown error',
      stack: error.stack,
      name: error.name,
      details: error instanceof z.ZodError ? error.errors : undefined,
    };

    // Attempt to update ticket status to FAILED
    try {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'FAILED',
          error: errorData as any
        }
      });

      // Notify frontend of failure
      await redisPublisher.publish('ticket-updates', JSON.stringify({
        type: 'TICKET_UPDATED',
        ticketId,
        status: 'FAILED',
        error: errorData
      }));

    } catch (dbError) {
      console.error("Failed to update ticket status to FAILED", dbError);
    }
  }
};

// Start Worker
queue.process('process-ticket', processTicket);

console.log('Worker started...');
