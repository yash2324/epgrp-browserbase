import { main as runAutomation } from "./lib/automation.js";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../stagehand.config.js";

export async function calculateCosts(formData: any, costOverrides: any) {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (!stagehand.page || !stagehand.context) {
    throw new Error("Stagehand page or context not initialized");
  }

  try {
    const result = await runAutomation({
      page: stagehand.page,
      context: stagehand.context,
      stagehand,
      formData,
      costOverrides,
    });

    return result;
  } finally {
    await stagehand.close();
  }
}
