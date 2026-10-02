import { expect, test as base } from "@playwright/test";

export { expect };
export const test = base.extend<{ runtimeErrors: void }>({
  runtimeErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        // The production gallery is the only expected browser error.
        const expected404 =
          process.env.E2E_PRODUCTION === "1" &&
          /Failed to load resource:.*404/.test(message.text()) &&
          new URL(message.location().url || "http://localhost/").pathname ===
            "/dev/ui";
        if (message.type() === "error" && !expected404) {
          errors.push(message.text());
        }
      });
      await use();
      expect(errors, "Browser console and runtime errors").toEqual([]);
    },
    { auto: true },
  ],
});
