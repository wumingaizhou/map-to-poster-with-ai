import { z } from "zod";

export const geocodeSchema = z.object({
  body: z.object({
    locationQuery: z.string().trim().min(1).max(100)
  })
});
