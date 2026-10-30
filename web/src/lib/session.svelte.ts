import { pb, validateSession } from "./pb";
import { accountPanel } from "./account.svelte";
import { mcpPanel } from "./mcpPanel.svelte";

class Session {
  user = $state(pb.authStore.record);
  ready = $state(false);

  constructor() {
    pb.authStore.onChange(() => {
      this.user = pb.authStore.record;
      if (!this.user) {
        accountPanel.open = false;
        mcpPanel.open = false;
      }
    });
    void validateSession(true).catch(() => {}).finally(() => { this.ready = true; });
    const resume = () => { void validateSession().catch(() => {}); };
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") resume();
    });
  }

  async login(username: string, password: string) {
    await pb.collection("users").authWithPassword(username.trim().toLowerCase(), password);
  }

  logout() {
    pb.authStore.clear();
  }
}

export const session = new Session();
