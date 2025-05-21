import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
import StagehandConfig from "./stagehand.config.js";
import chalk from "chalk";
import boxen from "boxen";
// Commenting out unused utils, can be restored if needed
// import { drawObserveOverlay, clearOverlays, actWithCache } from "./utils.js";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config(); // Load .env file

// Define interfaces for form data and overrides
interface FormData {
  Description: string;
  "Bag type": string;
  "Face Width mm": string;
  "Gusset mm": string;
  "Bag Length mm": string;
  "Bottom glue": string;
  "Packed in": string;
  "Pack size": string;
  "No of packs ordered": string;
  Machine: string;
  "Machines per supervisor": string;
}

interface CostOverride {
  field: string;
  value: string | number;
}

// Schema for extracting cost summary
const costSummarySchema = z.object({
  cost_per_case: z.string().optional().default("0.00"),
  labour_cost_per_job: z.string().optional().default("0.00"),
  overhead_cost: z.string().optional().default("0.00"),
});

async function main({
  page,
  context,
  stagehand,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
}) {
  const QB_USERID = process.env.QB_USERID;
  const QB_PASSWORD = process.env.QB_PASSWORD;

  if (!QB_USERID || !QB_PASSWORD) {
    const errorMessage =
      "QB_USERID and/or QB_PASSWORD missing – add them to your .env file";
    stagehand.log({
      message: errorMessage,
    });
    throw new Error(errorMessage);
  }

  // Sample data - in a real scenario, this would likely be passed as arguments or loaded
  const formData: FormData = {
    Description: "Test costing from Stagehand TS",
    "Bag type": "SOS Standard", // Example: Ensure this is a valid text of an option
    "Face Width mm": "120",
    "Gusset mm": "60",
    "Bag Length mm": "220",
    "Bottom glue": "Standard Glue",
    "Packed in": "Carton",
    "Pack size": "500",
    "No of packs ordered": "10",
    Machine: "Machine A", // Example: Ensure this is a valid text of an option
    "Machines per supervisor": "3",
  };

  const costOverrides: CostOverride[] = [
    { field: "bag_paper_price_override", value: "0.25" },
  ];

  let bagPaperPriceOverride: string | number | undefined;
  if (costOverrides) {
    for (const override of costOverrides) {
      if (override.field === "bag_paper_price_override") {
        bagPaperPriceOverride = override.value;
        stagehand.log({
          message: `Using bag paper price override: ${bagPaperPriceOverride}`,
        });
        break;
      }
    }
  }

  try {
    stagehand.log({ message: "Starting QuickBase automation process" });

    // 1. Login to QuickBase
    await page.goto("https://europackaging.quickbase.com");
    stagehand.log({ message: "Navigated to QuickBase login page" });

    await page.fill('input[name="loginid"]', QB_USERID); // Changed selector
    stagehand.log({ message: "Filled User ID" });
    await page.fill('input[name="password"]', QB_PASSWORD); // Changed selector
    stagehand.log({ message: "Filled Password" });
    await page.click("button#signin"); // Changed selector for sign-in button
    stagehand.log({ message: "Clicked Sign In button" });

    // Handle "Enable sign in" checkbox if it appears
    try {
      await page.waitForSelector('label:has-text("Enable sign in")', {
        timeout: 10000,
      });
      const enableSignInCheckbox = await page.$(
        'label:has-text("Enable sign in")'
      );
      if (enableSignInCheckbox && (await enableSignInCheckbox.isVisible())) {
        await enableSignInCheckbox.click();
        stagehand.log({ message: "Clicked 'Enable sign in' checkbox." });
      }
    } catch (e) {
      stagehand.log({
        message:
          "'Enable sign in' checkbox not found or not interactable, proceeding.",
      });
    }

    await page.waitForURL(
      "https://europackaging.quickbase.com/nav/main/action/myqb"
    );
    stagehand.log({ message: "Login successful, dashboard loaded" });

    // 2. Navigate to App
    const [appLinkAction] = await page.observe({
      instruction:
        'Find and click the "Anab testing copy - PPF costing system" link or button',
    });
    await page.act(appLinkAction);

    stagehand.log({
      message: "Navigated to 'Anab testing copy - PPF costing system' App",
    });

    // 3. Open SOS Costings
    const [sosCostingsAction] = await page.observe({
      instruction: 'Find and click the "SOS Costings" link or button',
    });
    await page.act(sosCostingsAction);
    // await page.click('text="SOS Costings"'); // Original line

    stagehand.log({ message: "Opened 'SOS Costings' section" });

    // 4. Create New Costing
    const [newCostingAction] = await page.observe({
      instruction: "Find and click the New SOS costing button",
    });
    await page.act(newCostingAction);
    stagehand.log({ message: "Clicked 'New SOS costing' button" });

    // 5. Collapse Side Panel (optional)
    try {
      const [collapseAction] = await page.observe({
        instruction: 'Find and click the "Collapse Side Panel" button',
      });
      await page.act(collapseAction);
      stagehand.log({ message: "Collapsed Side Panel" });
    } catch (e) {
      stagehand.log({
        message:
          "Collapse Side Panel button not found or not clickable, proceeding.",
      });
    }

    // 6. Fill the Form
    stagehand.log({ message: "Starting structured form filling" });

    // Section 1: Finished Bag Information
    stagehand.log({ message: "Filling Section 1: Finished Bag Information" });

    // Description
    try {
      const instruction = 'Find the input field labeled "Description"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, formData.Description);
        stagehand.log({
          message: `Filled "Description" with "${formData.Description}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Description": ${error.message}` });
    }

    // Bag type
    try {
      const instruction = 'Find the dropdown menu labeled "Bag type"';
      const valueToSelect = "Internal handle NEW";
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.selectOption(field.selector, { label: valueToSelect });
        stagehand.log({
          message: `Selected "${valueToSelect}" for "Bag type"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Bag type": ${error.message}` });
    }

    // Face Width mm
    try {
      const instruction = 'Find the input field labeled "Face Width mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, formData["Face Width mm"]);
        stagehand.log({
          message: `Filled "Face Width mm" with "${formData["Face Width mm"]}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error with "Face Width mm": ${error.message}`,
      });
    }

    // Gusset mm
    try {
      const instruction = 'Find the input field labeled "Gusset mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, formData["Gusset mm"]);
        stagehand.log({
          message: `Filled "Gusset mm" with "${formData["Gusset mm"]}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Gusset mm": ${error.message}` });
    }

    // Bag Length mm
    try {
      const instruction = 'Find the input field labeled "Bag Length mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, formData["Bag Length mm"]);
        stagehand.log({
          message: `Filled "Bag Length mm" with "${formData["Bag Length mm"]}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error with "Bag Length mm": ${error.message}`,
      });
    }

    // Section 2: Materials
    stagehand.log({ message: "Filling Section 2: Materials" });

    // BAG PAPER (select first option)
    try {
      stagehand.log({ message: "Attempting to select BAG PAPER" });
      // 1. Click the BAG PAPER input/search bar to reveal options
      const [bagPaperInput] = await page.observe({
        instruction: 'Find the input field or dropdown for "BAG PAPER"',
      });
      if (bagPaperInput && bagPaperInput.selector) {
        await page.waitForSelector(bagPaperInput.selector, { timeout: 10000 });
        await page.act(bagPaperInput);
        stagehand.log({ message: "Clicked BAG PAPER input/search bar" });
        await page.waitForTimeout(2000); // Wait for options to load

        // 2. Click the first option from the revealed list
        // Assuming the first option is identifiable, e.g., by being the first in a list or a specific role/text
        // This instruction might need refinement based on the actual HTML structure of the dropdown options
        const [firstBagPaperOption] = await page.observe({
          instruction: "Find the first option in the BAG PAPER dropdown list",
        });
        if (firstBagPaperOption && firstBagPaperOption.selector) {
          await page.waitForSelector(firstBagPaperOption.selector, {
            timeout: 10000,
          });
          await page.act(firstBagPaperOption);
          stagehand.log({ message: "Selected the first option for BAG PAPER" });
        } else {
          stagehand.log({
            message:
              "Could not observe the first option for BAG PAPER. Attempting generic click.",
          });
          // Fallback: try a more generic click if specific observation fails
          await page.act(
            "Click the first available option in the dropdown list below BAG PAPER"
          );
        }
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: "Could not observe the BAG PAPER input field. Skipping.",
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error selecting first option for "BAG PAPER": ${error.message}`,
      });
    }

    // Packed in (select "Box")
    try {
      const instruction = 'Find the dropdown menu labeled "Packed in"';
      const valueToSelect = "Box";
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.selectOption(field.selector, { label: valueToSelect }); // Assuming "Box" is a visible label
        stagehand.log({
          message: `Selected "${valueToSelect}" for "Packed in"`,
        });
        await page.waitForTimeout(1000); // Allow time for new fields to appear
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Packed in": ${error.message}` });
    }

    // Box type (select first option, appears after "Packed in" is "Box")
    try {
      stagehand.log({ message: "Attempting to select Box type" });
      // 1. Click the Box type input/search bar to reveal options
      const [boxTypeInput] = await page.observe({
        instruction: 'Find the input field or dropdown for "Box type"',
      });
      if (boxTypeInput && boxTypeInput.selector) {
        await page.waitForSelector(boxTypeInput.selector, { timeout: 10000 });
        await page.act(boxTypeInput);
        stagehand.log({ message: "Clicked Box type input/search bar" });
        await page.waitForTimeout(2000); // Wait for options to load

        // 2. Click the first option from the revealed list
        const [firstBoxTypeOption] = await page.observe({
          instruction: "Find the first option in the Box type dropdown list",
        });
        if (firstBoxTypeOption && firstBoxTypeOption.selector) {
          await page.waitForSelector(firstBoxTypeOption.selector, {
            timeout: 10000,
          });
          await page.act(firstBoxTypeOption);
          stagehand.log({ message: "Selected the first option for Box type" });
        } else {
          stagehand.log({
            message:
              "Could not observe the first option for Box type. Attempting generic click.",
          });
          // Fallback: try a more generic click
          await page.act(
            "Click the first available option in the dropdown list below Box type"
          );
        }
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: "Could not observe the Box type input field. Skipping.",
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error selecting first option for "Box type": ${error.message}`,
      });
    }

    // Bags per box
    try {
      const instruction = 'Find the input field labeled "Bags per box"';
      // Assuming formData has a key like "Bags per box" or you have a default/derived value
      const valueToFill = formData["Pack size"]; // Example: Reusing "Pack size" as per original Python logic for 'Pack size'
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, valueToFill);
        stagehand.log({
          message: `Filled "Bags per box" with "${valueToFill}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Bags per box": ${error.message}` });
    }

    // No of Boxes Ordered
    try {
      const instruction = 'Find the input field labeled "No of Boxes Ordered"';
      // Assuming formData has a key like "No of Boxes Ordered" or similar
      const valueToFill = formData["No of packs ordered"]; // Example: Reusing "No of packs ordered"
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, valueToFill);
        stagehand.log({
          message: `Filled "No of Boxes Ordered" with "${valueToFill}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error with "No of Boxes Ordered": ${error.message}`,
      });
    }

    // Boxes per Pallet
    try {
      const instruction = 'Find the input field labeled "Boxes per Pallet"';
      const valueToFill = "10"; // Example: Default or derived value, update as needed
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, valueToFill);
        stagehand.log({
          message: `Filled "Boxes per Pallet" with "${valueToFill}"`,
        });
        await page.waitForTimeout(500);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error with "Boxes per Pallet": ${error.message}`,
      });
    }
    await page.act("scroll to the bottom of the page");
    // Section 3: Production data
    stagehand.log({ message: "Filling Section 3: Production data" });

    // Machine (select first option)
    try {
      const instruction = 'Find the dropdown menu labeled "Machine"';
      stagehand.log({
        message: `Attempting to observe and select first option for: ${instruction}`,
      });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 10000 });
        const selectElement = await page.$(field.selector);
        if (selectElement) {
          const options = await selectElement.$$("option");
          if (options.length > 0) {
            const firstOptionValue = await options[0].getAttribute("value");
            if (firstOptionValue !== null && firstOptionValue !== "") {
              await page.selectOption(field.selector, {
                value: firstOptionValue,
              });
            } else {
              await page.selectOption(field.selector, { index: 0 });
            }
            stagehand.log({
              message: `Selected first option for: ${instruction}`,
            });
          } else {
            stagehand.log({ message: `No options found for: ${instruction}` });
          }
        } else {
          stagehand.log({
            message: `Select element not found for: ${instruction}`,
          });
        }
        await page.waitForTimeout(300);
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error selecting first option for "Machine": ${error.message}`,
      });
    }

    // Remove the old dynamic filling loop and bagPaperPriceOverride logic
    // The old for...of Object.entries(formData) loop is now replaced by the section-based filling above.
    // The old bagPaperPriceOverride logic is also removed as per the new structured approach.

    // 7. Scroll to bottom
    await page.act("scroll to the bottom of the page");
    await page.waitForTimeout(1000);
    stagehand.log({ message: "Scrolled to bottom of the page" });

    // 8. Extract cost summary data
    stagehand.log({ message: "Extracting cost summary data" });
    const extractionSelectors = {
      cost_per_case: 'input[aria-label="Cost £/case"]',
      labour_cost_per_job: 'input[aria-label="Total Labour & Sup\'n £/job"]',
      overhead_cost: 'input[aria-label="Overhead Cost/job"]',
    };

    const extractedValues: any = {}; // Using any for flexibility before parsing
    for (const key of Object.keys(extractionSelectors) as Array<
      keyof typeof extractionSelectors
    >) {
      const selector = extractionSelectors[key];
      try {
        await page.waitForSelector(selector, { timeout: 10000 });
        const element = await page.$(selector);
        if (element) {
          extractedValues[key] =
            (await element.getAttribute("value")) || "0.00";
        } else {
          stagehand.log({
            message: `Element for ${key} (selector: ${selector}) not found. Defaulting to '0.00'.`,
          }); // Fixed: Use LogLevel type
          extractedValues[key] = "0.00";
        }
      } catch (error: any) {
        stagehand.log({
          message: `Error extracting ${key} (selector: ${selector}): ${error.message}. Defaulting to '0.00'.`,
        }); // Fixed: Use LogLevel type
        extractedValues[key] = "0.00";
      }
    }

    const parsedResult = costSummarySchema.safeParse(extractedValues);

    if (parsedResult.success) {
      stagehand.log({
        message: "Successfully extracted and parsed cost summary",
        auxiliary: {
          data: { value: JSON.stringify(parsedResult.data), type: "object" },
        },
      });
      console.log(chalk.green("Extracted Cost Summary:"), parsedResult.data);
    } else {
      stagehand.log({
        message: "Failed to parse extracted cost summary",
        auxiliary: {
          errors: {
            value: JSON.stringify(parsedResult.error.issues),
            type: "object",
          },
          raw_values: {
            value: JSON.stringify(extractedValues),
            type: "object",
          },
        },
      });
      console.error(
        chalk.red("Failed to parse extracted data:"),
        parsedResult.error.issues
      );
      console.error(chalk.red("Raw extracted values:"), extractedValues);
    }
  } catch (error: any) {
    stagehand.log({
      message: `Critical error in QuickBase automation: ${error.message}`,
      auxiliary: { stack: { value: error.stack || "N/A", type: "string" } },
    });
    console.error(
      chalk.bgRed.white(
        `Critical error during QuickBase processing: ${error.message}`
      )
    );
    // Depending on desired behavior, you might want to re-throw to stop execution
    // throw error;
  }
}

/**
 * This is the main function that runs when you do npm run start
 *
 * YOU PROBABLY DON'T NEED TO MODIFY ANYTHING BELOW THIS POINT!
 *
 */
async function run() {
  const stagehand = new Stagehand({
    ...StagehandConfig,
  });
  await stagehand.init();

  if (StagehandConfig.env === "BROWSERBASE" && stagehand.browserbaseSessionID) {
    console.log(
      boxen(
        `View this session live in your browser: \n${chalk.blue(
          `https://browserbase.com/sessions/${stagehand.browserbaseSessionID}`
        )}`,
        {
          title: "Browserbase",
          padding: 1,
          margin: 3,
        }
      )
    );
  }

  if (!stagehand.page || !stagehand.context) {
    console.error(
      chalk.red("Stagehand page or context not initialized. Exiting.")
    );
    await stagehand.close(); // Attempt to close even if init failed partially
    return;
  }

  await main({
    page: stagehand.page,
    context: stagehand.context,
    stagehand,
  });

  await stagehand.close();
  console.log(
    `\n🤘 Thanks so much for using Stagehand! Reach out to us on Slack if you have any feedback: ${chalk.blue(
      "https://stagehand.dev/slack"
    )}\n`
  );
}

run().catch((error) => {
  console.error(
    chalk.bgRed.white(`Unhandled error in run function: ${error.message}`)
  );
  console.error(error.stack);
  process.exit(1);
});
