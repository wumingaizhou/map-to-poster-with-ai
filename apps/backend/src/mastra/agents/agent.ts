import { Agent } from "@mastra/core/agent";
import { config, getMastraDbUrl, requireApiKey } from "../../config/env";
import { exampleAgentPrompt } from "./prompts";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { posterIterateStyle } from "../tools/poster-iterate-style-tool";
const mastraAuthToken = config.ai.mastra.storageToken;
export const exampleAgent = new Agent({
  id: "example-agent",
  name: "example-agent",
  instructions: exampleAgentPrompt,
  model: {
    providerId: config.ai.exampleAgent.providerId,
    modelId: config.ai.exampleAgent.modelName,
    url: config.ai.exampleAgent.apiUrl,
    apiKey: config.isProduction ? requireApiKey("exampleAgent") : config.ai.exampleAgent.apiKey
  },
  memory: new Memory({
    storage: new LibSQLStore({
      id: "example-agent-storage",
      url: getMastraDbUrl("example-agent-memory.db"),
      ...(mastraAuthToken ? { authToken: mastraAuthToken } : {})
    }),
    options: {
      lastMessages: config.ai.exampleAgent.memory.lastMessages
    }
  }),
  tools: {
    posterIterateStyle: posterIterateStyle as any
  }
});
