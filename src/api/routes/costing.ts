import express from "express";
import AWS from "aws-sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.js";
import { main as runBrowserbaseAutomation } from "../../lib/automation.js";
import { CostingRequestPayload } from "../types.js";
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

router.post("/calculate-costs", async (req, res) => {
  try {
    const {
      formData,
      costOverrides,
      sender_email,
      spec_sheet_id,
    }: CostingRequestPayload = req.body;

    // Initialize Stagehand
    const stagehand = new Stagehand({
      ...StagehandConfig,
    });
    await stagehand.init();

    if (!stagehand.page || !stagehand.context) {
      throw new Error("Stagehand page or context not initialized");
    }

    // Run the browserbase automation
    const costSummary = await runBrowserbaseAutomation({
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
    await sendCostingSummaryEmail(sender_email, costSummary, spec_sheet_id);

    res.json({
      success: true,
      message: "Costing calculation completed and email sent",
      costSummary,
    });
  } catch (error: any) {
    console.error("Error in calculate-costs endpoint:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
