import { z } from "zod";
export const chatStreamSchema = z.object({
  body: z.object({
    userMessage: z.string().min(1, "userMessage is required"),
    config: z
      .object({
        threadId: z.string().min(1).optional()
      })
      .optional()
  })
});
export const streamSessionEventsSchema = z.object({
  params: z.object({
    threadId: z.string().min(1, "threadId is required")
  }),
  query: z
    .object({
      lastEventId: z.string().min(1).optional()
    })
    .passthrough()
});
