import { Stagehand, Page, BrowserContext } from "@browserbasehq/stagehand";
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

export async function main({
  page,
  context,
  stagehand,
  formData,
  costOverrides,
}: {
  page: Page;
  context: BrowserContext;
  stagehand: Stagehand;
  formData: FormData;
  costOverrides: CostOverride[];
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

  // Removed the extra closing brace that was here

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
    await page.waitForTimeout(10000);
    const [sosCostingsAction] = await page.observe({
      instruction: 'Find and click the "SOS Costings" link or button',
    });
    await page.act(sosCostingsAction);

    stagehand.log({ message: "Opened 'SOS Costings' section" });

    // 4. Create New Costing
    await page.waitForTimeout(5000);
    const [newCostingAction] = await page.observe({
      instruction: "Find and click the New SOS costing button",
    });
    await page.act(newCostingAction);
    stagehand.log({ message: "Clicked 'New SOS costing' button" });

    // 5. Collapse
    await page.waitForTimeout(5000);
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
      await page.waitForTimeout(5000);
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
      // Click the input to focus it
      await page.act('Click the input field labeled "BAG PAPER"');
      await page.waitForTimeout(500);

      // Type a space to trigger the dropdown
      await page.act('Type " " into the "BAG PAPER" input');
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");

      stagehand.log({ message: "Selected first option for BAG PAPER" });
      await page.waitForTimeout(1000);
    } catch (error: any) {
      stagehand.log({
        message: `Error selecting first option for "BAG PAPER": ${error.message}`,
      });
    }
    try {
      if (bagPaperPriceOverride !== undefined) {
        const instruction =
          'Find the input field labeled "Bag Paper Price Override"';
        stagehand.log({ message: `Attempting to observe: ${instruction}` });
        const [field] = await page.observe({ instruction });
        if (field && field.selector) {
          await page.waitForSelector(field.selector, { timeout: 15000 });
          await page.fill(field.selector, String(bagPaperPriceOverride));
          stagehand.log({
            message: `Filled "Bag Paper Price Override" with "${bagPaperPriceOverride}"`,
          });
          await page.waitForTimeout(500);
        } else {
          stagehand.log({
            message: `Could not observe: ${instruction}. Skipping.`,
          });
        }
      } else {
        stagehand.log({
          message: "No bag paper price override value provided, skipping.",
        });
      }
    } catch (error: any) {
      stagehand.log({
        message: `Error with "Bag Paper Price Override": ${error.message}`,
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
      // Click the input to focus it
      await page.act('Click the input field labeled "Box type"');
      await page.waitForTimeout(500);

      // Type a space to trigger the dropdown
      await page.act('Type " " into the "Box type" input');
      await page.waitForTimeout(1000);

      // Press ArrowDown and Enter to select the first option
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");

      stagehand.log({ message: "Selected first option for Box type" });
      await page.waitForTimeout(1000);
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
    await page.act("scroll the modal to the next chunk");
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

    await page.waitForTimeout(1000);
    stagehand.log({ message: "Scrolled to bottom of the page" });

    // 8. Extract cost summary data
    stagehand.log({ message: "Extracting cost summary data" });
    try {
      // First attempt: Try XPath approach
      const costResults = await Promise.all<string>([
        // Cost £/case
        page.evaluate(() => {
          const el =
            document.evaluate(
              '//td[contains(., "Cost £/case")]/following-sibling::td[1]',
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue || document.getElementById("tdf_153");

          return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
        }),
        // Total Labour & Sup'n £/job
        page.evaluate(() => {
          const el =
            document.evaluate(
              '//td[contains(., "Total Labour & Sup")]/following-sibling::td[1]',
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue || document.getElementById("tdf_137");

          return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
        }),
        // Overhead Cost/job
        page.evaluate(() => {
          const el =
            document.evaluate(
              '//td[contains(., "Overhead Cost/job")]/following-sibling::td[1]',
              document,
              null,
              XPathResult.FIRST_ORDERED_NODE_TYPE,
              null
            ).singleNodeValue || document.getElementById("tdf_142");

          return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
        }),
      ]);

      stagehand.log({
        message: `Raw cost values: ${JSON.stringify(costResults, null, 2)}`,
      });

      // If all values are still 0, try direct ID approach as last resort
      if (costResults.every((val) => parseFloat(val) === 0)) {
        stagehand.log({
          message: "Primary extraction failed, trying direct ID approach",
        });

        const directResults = await Promise.all<string>([
          page.evaluate(() => {
            const el = document.getElementById("tdf_153");
            return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
          }),
          page.evaluate(() => {
            const el = document.getElementById("tdf_137");
            return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
          }),
          page.evaluate(() => {
            const el = document.getElementById("tdf_142");
            return el?.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
          }),
        ]);

        if (directResults.some((val) => parseFloat(val) > 0)) {
          stagehand.log({
            message: `Direct ID extraction succeeded: ${JSON.stringify(
              directResults,
              null,
              2
            )}`,
          });
          costResults.splice(0, costResults.length, ...directResults);
        }
      }

      const [Costcase, totalLabour, overheadCost] = costResults.map(
        (val) => parseFloat(val) || 0
      );

      stagehand.log({
        message: `Parsed cost values:
          Cost per case: ${Costcase}
          Total Labour & Sup: ${totalLabour}
          Overhead Cost per job: ${overheadCost}`,
      });

      // Create the cost summary object
      const costSummary = {
        Costcase: Costcase,
        totalLabour: totalLabour,
        OverheadCostperjob: overheadCost,
      };

      stagehand.log({
        message: `Final cost summary: ${JSON.stringify(costSummary, null, 2)}`,
      });

      return costSummary;
    } catch (error: any) {
      stagehand.log({
        message: `Error extracting cost summary data: ${error.message}`,
      });
      throw error;
    } finally {
      await stagehand.close();
    }
  } catch (error: any) {
    stagehand.log({
      message: `Error in main function: ${error.message}`,
    });
    throw error;
  }
}
