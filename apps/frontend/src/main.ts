import { createApp } from "vue";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import "./assets/styles/main.css";
import { handleError } from "@/shared/error-handler";
import { runtimeEnv } from "@/config";
import { prefetchAuthToken } from "@/services/auth/auth-session";

const app = createApp(App);

app.use(createPinia());
app.use(router);

// 预取匿名会话 token（不阻塞页面渲染）；token 仅内存持有，刷新/关页即失效
prefetchAuthToken();

// 全局兜底：捕获未处理错误，避免只留在控制台而不经由统一错误处理
app.config.errorHandler = (err, _instance, info) => {
  handleError(err, {
    customMessage: runtimeEnv.isDev ? `Vue 运行时错误：${info}` : undefined,
    showToast: runtimeEnv.isDev
  });
};

window.addEventListener("unhandledrejection", event => {
  handleError(event.reason, {
    customMessage: "未处理的 Promise 拒绝",
    showToast: runtimeEnv.isDev
  });
});

window.addEventListener("error", event => {
  handleError((event as ErrorEvent).error ?? (event as ErrorEvent).message, {
    customMessage: "未捕获的运行时错误",
    showToast: runtimeEnv.isDev
  });
});

app.mount("#app");
