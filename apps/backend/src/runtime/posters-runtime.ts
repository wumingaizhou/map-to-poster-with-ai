import { config } from "../config/env";
import { PostersService } from "../services/business/posters-service";
import { ThemeOverrideService } from "../services/business/theme-override-service";
import { LocalFilePosterAssetStore } from "../services/infra/posters/poster-asset-store";
import { PosterRenderer } from "../services/infra/posters/poster-renderer";
import { InMemoryPosterSessionStore } from "../services/infra/posters/poster-session-store";
import { PosterThemeRepository } from "../services/infra/theme/poster-theme-repository";

const themeRepository = new PosterThemeRepository();
const themeOverrideService = new ThemeOverrideService();
const posterRenderer = new PosterRenderer(themeRepository, themeOverrideService);
const sessionStore = new InMemoryPosterSessionStore();
const assetStore = new LocalFilePosterAssetStore();
const postersService = new PostersService(
  themeOverrideService,
  posterRenderer,
  sessionStore,
  assetStore,
  config.posters.png.dpi
);
export const postersRuntime = {
  themeRepository,
  posterRenderer,
  postersService,
  sessionStore,
  assetStore
};
