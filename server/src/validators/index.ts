
import { z } from 'zod';

export const createTicketSchema = z.object({
  content: z.string().min(10, "Content must be at least 10 characters long").max(2000),
});

export const llmResponseSchema = z.object({
  category: z.enum(["Billing", "Technical", "Goal", "Feature", "Other"]), // Adjusted to include Goal if needed
  urgency: z.enum(["High", "Medium", "Low"]),
  sentiment: z.number().int().min(1).max(10),
  draftReply: z.string(),
});
