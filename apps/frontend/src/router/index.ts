import { createRouter, createWebHistory } from "vue-router";
import HomePage from "@/views/HomePage.vue";
import PosterEditorPage from "@/views/PosterEditorPage.vue";
import { runtimeEnv } from "@/config";
const router = createRouter({
  history: createWebHistory(runtimeEnv.baseUrl),
  routes: [
    { path: "/", name: "home", component: HomePage },
    { path: "/editor/:sessionId", name: "editor", component: PosterEditorPage, props: true }
  ]
});
export default router;
