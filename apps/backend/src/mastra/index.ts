import { Mastra } from "@mastra/core";
import { exampleAgent } from "./agents/agent";
import { LibSQLStore } from "@mastra/libsql";
import { config, getMastraDbUrl } from "../config/env";
import { DefaultExporter, Observability } from "@mastra/observability";
import { posterIterateStyle } from "./tools/poster-iterate-style-tool";
const mastraAuthToken = config.ai.mastra.storageToken;
export const mastra = new Mastra({
  agents: { exampleAgent },
  storage: new LibSQLStore({
    id: "mastra-storage",
    url: getMastraDbUrl("mastra.db"),
    ...(mastraAuthToken ? { authToken: mastraAuthToken } : {})
  }),
  tools: {
    posterIterateStyle: posterIterateStyle as any
  },
  server: {
    port: config.ai.mastra.serverPort,
    host: config.ai.mastra.host,
    studioBase: config.ai.mastra.studioBase
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra",
        exporters: [new DefaultExporter()]
      }
    }
  })
});
