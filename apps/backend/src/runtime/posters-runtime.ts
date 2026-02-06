import { config } from "../config/env";
import { PostersService } from "../services/business/posters-service";
import { ThemeOverrideService } from "../services/business/theme-override-service";
import { LocalFilePosterAssetStore } from "../services/infra/posters/poster-asset-store";
import { InMemoryPosterSessionStore } from "../services/infra/posters/poster-session-store";
import { PosterWorkerPool } from "../services/infra/posters/poster-worker-pool";
import { PosterThemeRepository } from "../services/infra/theme/poster-theme-repository";
const themeRepository = new PosterThemeRepository();
const themeOverrideService = new ThemeOverrideService();
const workerPool = new PosterWorkerPool();
const sessionStore = new InMemoryPosterSessionStore();
const assetStore = new LocalFilePosterAssetStore();
const postersService = new PostersService(
  themeOverrideService,
  workerPool,
  sessionStore,
  assetStore,
  config.posters.png.dpi
);
export const postersRuntime = {
  themeRepository,
  workerPool,
  postersService,
  sessionStore,
  assetStore
};
