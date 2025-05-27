import express, { Request, Response } from "express";
import AWS from "aws-sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.js";
import { main as runBrowserbaseAutomation } from "../../lib/automation.js";
import {
  CostingRequestPayload,
  MultipleCostingRequest,
  MultipleCostingRequestPayload,
} from "../types.js";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();

// Configure AWS SES
AWS.config.update({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const ses = new AWS.SES();

async function sendCostingSummaryEmail(
  toEmail: string,
  costSummary: any,
  filledFields: Record<string, string>,
  specSheetId: string
): Promise<void> {
  const params = {
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Body: {
        Html: {
          Data: `
                        <h2>Costing Summary for Spec Sheet ${specSheetId}</h2>
                        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                            <tr style="background-color: #f2f2f2;">
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Cost Type</th>
                                <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Amount</th>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #ddd;">Cost/€ Case</td>
                                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${costSummary.Costcase.toFixed(
                                  2
                                )}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #ddd;">Total Labour & Sup</td>
                                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${costSummary.totalLabour.toFixed(
                                  2
                                )}</td>
                            </tr>
                            <tr>
                                <td style="padding: 12px; border: 1px solid #ddd;">Overhead Cost/ Job</td>
                                <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${costSummary.OverheadCostperjob.toFixed(
                                  2
                                )}</td>
                            </tr>
                           
                        </table>
                        <h3 style="margin-top:32px;">Filled Form Values</h3>
                        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                          <tr style="background-color: #f9f9f9;">
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Field</th>
                            <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Value</th>
                          </tr>
                          ${Object.entries(filledFields)
                            .map(
                              ([key, value]) => `
                                <tr>
                                  <td style="padding: 10px; border: 1px solid #ddd;">${key}</td>
                                  <td style="padding: 10px; border: 1px solid #ddd;">${value}</td>
                                </tr>
                              `
                            )
                            .join("")}
                        </table>
                    `,
        },
      },
      Subject: {
        Data: `Costing Summary for Spec Sheet ${specSheetId}`,
      },
    },
    Source: process.env.SES_FROM_EMAIL || "noreply@yourdomain.com",
  };

  try {
    await ses.sendEmail(params).promise();
    console.log(`Successfully sent costing summary email to ${toEmail}`);
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

async function sendMultipleCostingSummaryEmail(
  toEmail: string,
  results: Array<{
    payload: MultipleCostingRequestPayload;
    costSummary: any;
    filledFields: Record<string, string>;
  }>,
  trackingId: string
): Promise<void> {
  const params = {
    Destination: {
      ToAddresses: [toEmail],
    },
    Message: {
      Body: {
        Html: {
          Data: `
                        <h2>Multiple Costing Summary for Tracking ID: ${trackingId}</h2>
                        ${results
                          .map(
                            (result, index) => `
                            <div style="margin-bottom: 40px; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
                                <h3>Configuration ${index + 1} (Row ${
                              result.payload.rowIndex
                            })</h3>
                                <table style="border-collapse: collapse; width: 100%; max-width: 600px; margin-bottom: 20px;">
                                    <tr style="background-color: #f2f2f2;">
                                        <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Cost Type</th>
                                        <th style="padding: 12px; border: 1px solid #ddd; text-align: right;">Amount</th>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border: 1px solid #ddd;">Cost/€ Case</td>
                                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${result.costSummary.Costcase.toFixed(
                                          2
                                        )}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border: 1px solid #ddd;">Total Labour & Sup</td>
                                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${result.costSummary.totalLabour.toFixed(
                                          2
                                        )}</td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 12px; border: 1px solid #ddd;">Overhead Cost/ Job</td>
                                        <td style="padding: 12px; border: 1px solid #ddd; text-align: right;">£${result.costSummary.OverheadCostperjob.toFixed(
                                          2
                                        )}</td>
                                    </tr>
                                </table>
                                <h4>Form Values for Configuration ${
                                  index + 1
                                }</h4>
                                <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
                                  <tr style="background-color: #f9f9f9;">
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Field</th>
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Value</th>
                                  </tr>
                                  ${Object.entries(result.filledFields)
                                    .map(
                                      ([key, value]) => `
                                        <tr>
                                          <td style="padding: 10px; border: 1px solid #ddd;">${key}</td>
                                          <td style="padding: 10px; border: 1px solid #ddd;">${value}</td>
                                        </tr>
                                      `
                                    )
                                    .join("")}
                                </table>
                            </div>
                            `
                          )
                          .join("")}
                        
                        <div style="margin-top: 40px; padding: 20px; background-color: #f8f9fa; border-radius: 5px;">
                            <h3>Summary Overview</h3>
                            <p><strong>Total Configurations:</strong> ${
                              results.length
                            }</p>
                            <p><strong>Total Cost/€ Case:</strong> £${results
                              .reduce(
                                (sum, result) =>
                                  sum + result.costSummary.Costcase,
                                0
                              )
                              .toFixed(2)}</p>
                            <p><strong>Total Labour & Sup:</strong> £${results
                              .reduce(
                                (sum, result) =>
                                  sum + result.costSummary.totalLabour,
                                0
                              )
                              .toFixed(2)}</p>
                            <p><strong>Total Overhead Cost:</strong> £${results
                              .reduce(
                                (sum, result) =>
                                  sum + result.costSummary.OverheadCostperjob,
                                0
                              )
                              .toFixed(2)}</p>
                        </div>
                    `,
        },
      },
      Subject: {
        Data: `Multiple Costing Summary for Tracking ID: ${trackingId}`,
      },
    },
    Source: process.env.SES_FROM_EMAIL || "noreply@yourdomain.com",
  };

  try {
    await ses.sendEmail(params).promise();
    console.log(
      `Successfully sent multiple costing summary email to ${toEmail}`
    );
  } catch (error) {
    console.error("Error sending multiple costing email:", error);
    throw error;
  }
}

// Helper function to process a single automation with proper cleanup
async function processAutomation(payload: MultipleCostingRequestPayload) {
  let stagehand: Stagehand | null = null;

  try {
    // Initialize Stagehand
    stagehand = new Stagehand({
      ...StagehandConfig,
    });
    await stagehand.init();

    if (!stagehand.page || !stagehand.context) {
      throw new Error("Stagehand page or context not initialized");
    }

    // Run the browserbase automation
    const { costSummary, filledFields } = await runBrowserbaseAutomation({
      page: stagehand.page,
      context: stagehand.context,
      stagehand,
      formData: payload.formData,
      costOverrides: payload.costOverrides,
    });

    if (!costSummary) {
      throw new Error(
        `Failed to calculate costs for payload with rowIndex ${payload.rowIndex}`
      );
    }

    return {
      success: true,
      payload,
      costSummary,
      filledFields,
    };
  } catch (error) {
    console.error(`Error processing payload ${payload.rowIndex}:`, error);
    return {
      success: false,
      payload,
      error: `Failed to process payload ${payload.rowIndex}: ${
        (error as Error).message
      }`,
    };
  } finally {
    // Always close Stagehand instance
    if (stagehand) {
      try {
        await stagehand.close();
      } catch (closeError) {
        console.error(
          `Error closing Stagehand for payload ${payload.rowIndex}:`,
          closeError
        );
      }
    }
  }
}

// Limit concurrent processing to avoid resource exhaustion
async function processInBatches<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = 2
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

router.post(
  "/calculate-costs",
  async (req: Request, res: Response): Promise<void> => {
    let stagehand: Stagehand | null = null;

    try {
      const {
        formData,
        costOverrides,
        sender_email,
        specSheetId,
      }: CostingRequestPayload = req.body;

      // Initialize Stagehand
      stagehand = new Stagehand({
        ...StagehandConfig,
      });
      await stagehand.init();

      if (!stagehand.page || !stagehand.context) {
        throw new Error("Stagehand page or context not initialized");
      }

      // Run the browserbase automation
      const { costSummary, filledFields } = await runBrowserbaseAutomation({
        page: stagehand.page,
        context: stagehand.context,
        stagehand,
        formData,
        costOverrides,
      });

      if (!costSummary) {
        throw new Error("Failed to calculate costs");
      }

      // Send email with results
      await sendCostingSummaryEmail(
        sender_email,
        costSummary,
        filledFields,
        specSheetId
      );

      res.json({
        success: true,
        message: "Costing calculation completed and email sent",
        costSummary,
        filledFields,
      });
    } catch (error: any) {
      console.error("Error in calculate-costs endpoint:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    } finally {
      // Always close Stagehand instance
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (closeError) {
          console.error("Error closing Stagehand:", closeError);
        }
      }
    }
  }
);

router.post(
  "/calculate-costs/multiple",
  async (req: Request, res: Response): Promise<void> => {
    try {
      // Handle both direct array and object with payloads property
      let payloads: MultipleCostingRequestPayload[];

      if (Array.isArray(req.body)) {
        // Direct array format
        payloads = req.body;
      } else if (req.body.payloads && Array.isArray(req.body.payloads)) {
        // Object with payloads property
        payloads = req.body.payloads;
      } else {
        res.status(400).json({
          success: false,
          error:
            "Invalid payload: expected array of payloads or object with payloads property",
        });
        return;
      }

      if (payloads.length === 0) {
        res.status(400).json({
          success: false,
          error: "No payloads provided",
        });
        return;
      }

      console.log(
        `Processing ${payloads.length} costing calculations in batches`
      );

      // Process payloads in batches to avoid resource exhaustion
      const results = await processInBatches(payloads, processAutomation, 3);

      // Separate successful and failed results
      const successfulResults = results.filter((r) => r.success) as Array<{
        success: true;
        payload: MultipleCostingRequestPayload;
        costSummary: any;
        filledFields: Record<string, string>;
      }>;

      const failedResults = results.filter((r) => !r.success) as Array<{
        success: false;
        payload: MultipleCostingRequestPayload;
        error: string;
      }>;

      if (failedResults.length > 0) {
        console.warn(
          `${failedResults.length} automations failed:`,
          failedResults.map((r) => `Row ${r.payload.rowIndex}: ${r.error}`)
        );
      }

      if (successfulResults.length === 0) {
        res.status(500).json({
          success: false,
          error: "All automations failed",
          failures: failedResults.map((r) => ({
            rowIndex: r.payload.rowIndex,
            error: r.error,
          })),
        });
        return;
      }

      // Get email from first payload (assuming all have same sender_email)
      const senderEmail = payloads[0].sender_email;
      const trackingId = payloads[0].trackingId;

      // Send combined email with successful results only
      await sendMultipleCostingSummaryEmail(
        senderEmail,
        successfulResults,
        trackingId
      );

      const response: any = {
        success: true,
        message: `Multiple costing calculations completed and email sent. Processed ${successfulResults.length} configurations successfully.`,
        results: successfulResults.map((r) => ({
          rowIndex: r.payload.rowIndex,
          costSummary: r.costSummary,
          filledFields: r.filledFields,
        })),
        trackingId,
      };

      // Include failure information if there were any
      if (failedResults.length > 0) {
        response.partialSuccess = true;
        response.failures = failedResults.map((r) => ({
          rowIndex: r.payload.rowIndex,
          error: r.error,
        }));
        response.message += ` ${failedResults.length} configurations failed.`;
      }

      res.json(response);
    } catch (error: any) {
      console.error("Error in calculate-costs/multiple endpoint:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }
);

export default router;
