import { z } from "zod";

export const submitFeedbackSchema = z.object({
  body: z.object({
    type: z.enum(["suggestion", "bug", "other"]),
    content: z.string().trim().min(1).max(2000),
    contact: z.string().trim().max(200).optional().default("")
  })
});
