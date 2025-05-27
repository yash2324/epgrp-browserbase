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

// Helper function to extract numeric values
const extractNumeric = (value: string): string => {
  return value.replace(/[^0-9.]/g, "");
};

// Enhanced helper function to select and verify BAG PAPER with immediate retry
async function selectAndVerifyBagPaper(
  page: Page,
  stagehand: Stagehand
): Promise<boolean> {
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      stagehand.log({ message: `BAG PAPER selection attempt ${attempt}` });

      // Click the input to focus it
      await page.act('Click the input field labeled "BAG PAPER"');
      await page.waitForTimeout(500);

      // Type a space to trigger the dropdown
      await page.act('Type " " into the "BAG PAPER" input');
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      // Immediately verify the selection
      stagehand.log({ message: "Verifying BAG PAPER selection..." });
      const instruction = 'Find the input field containing "BAG PAPER"';
      const [field] = await page.observe({ instruction });

      if (field && field.selector) {
        const currentValue = await page.$eval(
          field.selector,
          (el: any) => el.value
        );
        stagehand.log({
          message: `BAG PAPER current value: "${currentValue}"`,
        });

        if (currentValue && currentValue.trim() !== "") {
          stagehand.log({
            message: `BAG PAPER successfully selected: "${currentValue}"`,
          });
          return true;
        }
      }

      if (attempt < maxRetries) {
        stagehand.log({
          message: `BAG PAPER not properly selected, retrying...`,
        });
        await page.waitForTimeout(500);
      }
    } catch (error: any) {
      stagehand.log({
        message: `BAG PAPER selection attempt ${attempt} failed: ${error.message}`,
      });
      if (attempt < maxRetries) {
        await page.waitForTimeout(500);
      }
    }
  }

  stagehand.log({ message: "BAG PAPER selection failed after all retries" });
  return false;
}

// Enhanced helper function to select and verify Box Type with immediate retry
async function selectAndVerifyBoxType(
  page: Page,
  stagehand: Stagehand
): Promise<boolean> {
  const maxRetries = 2;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      stagehand.log({ message: `Box Type selection attempt ${attempt}` });

      // Click the input to focus it
      await page.act('Click the input field labeled "Box Type*"');
      await page.waitForTimeout(500);

      // Type a space to trigger the dropdown
      await page.act('Type " " into the "Box Type" input');
      await page.waitForTimeout(500);

      // Press ArrowDown and Enter to select the first option
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(500);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(500);

      // Immediately verify the selection
      stagehand.log({ message: "Verifying Box Type selection..." });
      const instruction = 'Find the input field containing "Box Type*"';
      const [field] = await page.observe({ instruction });

      if (field && field.selector) {
        const currentValue = await page.$eval(
          field.selector,
          (el: any) => el.value
        );
        stagehand.log({ message: `Box Type current value: "${currentValue}"` });

        if (currentValue && currentValue.trim() !== "") {
          stagehand.log({
            message: `Box Type successfully selected: "${currentValue}"`,
          });
          return true;
        }
      }

      if (attempt < maxRetries) {
        stagehand.log({
          message: `Box Type not properly selected, retrying...`,
        });
        await page.waitForTimeout(500);
      }
    } catch (error: any) {
      stagehand.log({
        message: `Box Type selection attempt ${attempt} failed: ${error.message}`,
      });
      if (attempt < maxRetries) {
        await page.waitForTimeout(500);
      }
    }
  }

  stagehand.log({ message: "Box Type selection failed after all retries" });
  return false;
}

// Helper function to extract and validate cost summary
async function extractAndValidateCostSummary({
  page,
  formData,
  stagehand,
}: {
  page: Page;
  formData: FormData;
  stagehand: Stagehand;
}): Promise<{
  Costcase: number;
  totalLabour: number;
  OverheadCostperjob: number;
}> {
  // Extract cost summary data
  const getCostValues = async () => {
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
    // If all values are still 0, try direct ID approach as last resort
    if (costResults.every((val) => parseFloat(val) === 0)) {
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
        costResults.splice(0, costResults.length, ...directResults);
      }
    }
    const [Costcase, totalLabour, overheadCost] = costResults.map(
      (val) => parseFloat(val) || 0
    );
    return { Costcase, totalLabour, OverheadCostperjob: overheadCost };
  };

  // Validation and re-filling logic
  const validateAndRefill = async () => {
    // Re-verify all critical fields in Finished Bag Information
    const criticalFields = [
      "Face Width mm",
      "Gusset mm",
      "Bag Length mm",
      "Bags per box",
      "No of Boxes Ordered",
    ];
    for (const fieldName of criticalFields) {
      try {
        const instruction = `Find the input field labeled "${fieldName}"`;
        const [field] = await page.observe({ instruction });
        if (field && field.selector) {
          const currentValue = await page.$eval(
            field.selector,
            (el: any) => el.value
          );
          if (!currentValue || currentValue === "0") {
            stagehand.log({
              message: `Found empty/zero value for ${fieldName}, attempting to re-enter`,
            });
            // Re-enter the value based on formData
            let valueToEnter = "";
            if (fieldName === "Bags per box") {
              valueToEnter = extractNumeric(formData["Pack size"]);
            } else if (fieldName === "No of Boxes Ordered") {
              valueToEnter = extractNumeric(formData["No of packs ordered"]);
            } else {
              valueToEnter = extractNumeric(
                formData[fieldName as keyof FormData] || ""
              );
            }
            if (valueToEnter) {
              await page.fill(field.selector, valueToEnter);
              stagehand.log({
                message: `Re-entered ${fieldName} with ${valueToEnter}`,
              });
              await page.waitForTimeout(500);
            }
          }
        }
      } catch (error: any) {
        stagehand.log({
          message: `Error validating ${fieldName}: ${error.message}`,
        });
      }
    }

    // Re-verify BAG PAPER selection with enhanced retry
    stagehand.log({ message: "Re-verifying BAG PAPER selection..." });
    await selectAndVerifyBagPaper(page, stagehand);

    // Re-verify Box Type selection with enhanced retry
    stagehand.log({ message: "Re-verifying Box Type selection..." });
    await selectAndVerifyBoxType(page, stagehand);

    // Wait for recalculation
    await page.waitForTimeout(5000);
  };

  // Retry loop
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    stagehand.log({ message: `Cost extraction attempt ${attempt}` });
    const costSummary = await getCostValues();
    stagehand.log({
      message: `Attempt ${attempt} - Cost values: ${JSON.stringify(
        costSummary
      )}`,
    });
    if (
      costSummary.Costcase > 0 &&
      costSummary.totalLabour > 0 &&
      costSummary.OverheadCostperjob > 0
    ) {
      return costSummary;
    }
    if (attempt < maxRetries) {
      stagehand.log({
        message: `Detected zero values in cost summary. Attempting to validate and fix entries... (attempt ${attempt})`,
      });
      await validateAndRefill();
    }
  }
  // Final attempt, return whatever we have
  stagehand.log({
    message: `Returning cost summary after max retries.`,
  });
  return await getCostValues();
}

// Helper to extract all filled form field values by label
async function extractFilledFields(
  page: Page,
  formData: FormData,
  stagehand: Stagehand
): Promise<Record<string, string>> {
  const fieldLabels = [
    "Description",
    "Bag type",
    "Face Width mm",
    "Gusset mm",
    "Bag Length mm",
    "Bottom glue",
    "Packed in",
    "Pack size",
    "No of packs ordered",
    "Machine",
    "Machines per supervisor",
    "Bags per box",
    "No of Boxes Ordered",
    "Boxes per Pallet",
  ];
  const filled: Record<string, string> = {};
  for (const label of fieldLabels) {
    try {
      const instruction = `Find the input field labeled "${label}"`;
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        const value = await page.$eval(field.selector, (el: any) => el.value);
        filled[label] = value;
      }
    } catch (e) {
      stagehand.log({ message: `Could not extract value for field: ${label}` });
    }
  }
  return filled;
}

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
    await page.waitForTimeout(5000);
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
    await page.waitForTimeout(500);
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

    // Description (non-numeric, keep as is)
    try {
      await page.waitForTimeout(500);
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

    // Face Width mm (numeric)
    try {
      const instruction = 'Find the input field labeled "Face Width mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        const numericValue = extractNumeric(formData["Face Width mm"]);
        await page.fill(field.selector, numericValue);
        stagehand.log({
          message: `Filled "Face Width mm" with "${numericValue}"`,
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

    // Gusset mm (numeric)
    try {
      const instruction = 'Find the input field labeled "Gusset mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        const numericValue = extractNumeric(formData["Gusset mm"]);
        await page.fill(field.selector, numericValue);
        stagehand.log({
          message: `Filled "Gusset mm" with "${numericValue}"`,
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

    // Bag Length mm (numeric)
    try {
      const instruction = 'Find the input field labeled "Bag Length mm"';
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        const numericValue = extractNumeric(formData["Bag Length mm"]);
        await page.fill(field.selector, numericValue);
        stagehand.log({
          message: `Filled "Bag Length mm" with "${numericValue}"`,
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

    // BAG PAPER (select first option) - Enhanced with immediate verification and retry
    const bagPaperSuccess = await selectAndVerifyBagPaper(page, stagehand);
    if (!bagPaperSuccess) {
      stagehand.log({
        message: "WARNING: BAG PAPER selection may have failed",
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
        await page.waitForTimeout(500); // Allow time for new fields to appear
      } else {
        stagehand.log({
          message: `Could not observe: ${instruction}. Skipping.`,
        });
      }
    } catch (error: any) {
      stagehand.log({ message: `Error with "Packed in": ${error.message}` });
    }

    // Box type (select first option, appears after "Packed in" is "Box") - Enhanced with immediate verification and retry
    const boxTypeSuccess = await selectAndVerifyBoxType(page, stagehand);
    if (!boxTypeSuccess) {
      stagehand.log({ message: "WARNING: Box Type selection may have failed" });
    }

    // Bags per box (numeric)
    try {
      const instruction = 'Find the input field labeled "Bags per box"';
      const numericValue = extractNumeric(formData["Pack size"]);
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, numericValue);
        stagehand.log({
          message: `Filled "Bags per box" with "${numericValue}"`,
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

    // No of Boxes Ordered (numeric)
    try {
      const instruction = 'Find the input field labeled "No of Boxes Ordered"';
      const numericValue = extractNumeric(formData["No of packs ordered"]);
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, numericValue);
        stagehand.log({
          message: `Filled "No of Boxes Ordered" with "${numericValue}"`,
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

    // Boxes per Pallet (numeric)
    try {
      const instruction = 'Find the input field labeled "Boxes per Pallet"';
      const valueToFill = "10"; // This is already numeric
      stagehand.log({ message: `Attempting to observe: ${instruction}` });
      const [field] = await page.observe({ instruction });
      if (field && field.selector) {
        await page.waitForSelector(field.selector, { timeout: 15000 });
        await page.fill(field.selector, valueToFill);
        await page.act(
          "Click anywhere outside the field or click tab before moving forward"
        );
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
    await page.waitForTimeout(500);
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

    await page.waitForTimeout(500);
    stagehand.log({ message: "Scrolled to bottom of the page" });

    // 8. Extract cost summary data
    stagehand.log({ message: "Extracting cost summary data" });
    try {
      const costSummary = await extractAndValidateCostSummary({
        page,
        formData,
        stagehand,
      });
      // Extract all filled field values
      const filledFields = await extractFilledFields(page, formData, stagehand);
      stagehand.log({
        message: `Final cost summary: ${JSON.stringify(costSummary, null, 2)}`,
      });
      return { costSummary, filledFields };
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
