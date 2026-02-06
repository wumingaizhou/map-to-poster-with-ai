import { watch, onUnmounted, type Ref } from "vue";
type ScrollLockSnapshot = {
  overflow: string;
  position: string;
  width: string;
};
let scrollLockCount = 0;
let scrollLockSnapshot: ScrollLockSnapshot | null = null;
function applyScrollLock(): void {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) {
    const style = document.body.style;
    scrollLockSnapshot = {
      overflow: style.overflow,
      position: style.position,
      width: style.width
    };
    style.overflow = "hidden";
    style.position = "fixed";
    style.width = "100%";
  }
  scrollLockCount += 1;
}
function releaseScrollLock(): void {
  if (typeof document === "undefined") return;
  if (scrollLockCount === 0) return;
  scrollLockCount -= 1;
  if (scrollLockCount === 0) {
    const style = document.body.style;
    if (scrollLockSnapshot) {
      style.overflow = scrollLockSnapshot.overflow;
      style.position = scrollLockSnapshot.position;
      style.width = scrollLockSnapshot.width;
    } else {
      style.overflow = "";
      style.position = "";
      style.width = "";
    }
    scrollLockSnapshot = null;
  }
}
export function useScrollLock(isLocked: Readonly<Ref<boolean>>) {
  let lockedByThisScope = false;
  watch(
    isLocked,
    locked => {
      if (locked && !lockedByThisScope) {
        applyScrollLock();
        lockedByThisScope = true;
        return;
      }
      if (!locked && lockedByThisScope) {
        releaseScrollLock();
        lockedByThisScope = false;
      }
    },
    { immediate: true }
  );
  onUnmounted(() => {
    if (!lockedByThisScope) return;
    releaseScrollLock();
    lockedByThisScope = false;
  });
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    scrollLockCount = 0;
    if (typeof document !== "undefined") {
      const style = document.body.style;
      if (scrollLockSnapshot) {
        style.overflow = scrollLockSnapshot.overflow;
        style.position = scrollLockSnapshot.position;
        style.width = scrollLockSnapshot.width;
      } else {
        style.overflow = "";
        style.position = "";
        style.width = "";
      }
    }
    scrollLockSnapshot = null;
  });
}
