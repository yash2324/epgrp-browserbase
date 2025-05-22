import express from "express";
import AWS from "aws-sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.js";

const router = express.Router();

interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  timestamp: string;
  checks: {
    aws: {
      status: "healthy" | "unhealthy";
      message?: string;
    };
    stagehand: {
      status: "healthy" | "unhealthy";
      message?: string;
    };
  };
  uptime: string;
}

router.get("/", async (req, res) => {
  const healthCheck: HealthCheckResponse = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    checks: {
      aws: {
        status: "healthy",
      },
      stagehand: {
        status: "healthy",
      },
    },
    uptime: `${Math.floor(process.uptime())} seconds`,
  };

  try {
    // Check AWS SES health
    const ses = new AWS.SES();
    await ses.getSendQuota().promise();
  } catch (error: any) {
    healthCheck.checks.aws = {
      status: "unhealthy",
      message: `AWS SES Error: ${error.message}`,
    };
    healthCheck.status = "unhealthy";
  }

  try {
    // Check Stagehand health
    const stagehand = new Stagehand({
      ...StagehandConfig,
    });
    await stagehand.init();
    await stagehand.close();
  } catch (error: any) {
    healthCheck.checks.stagehand = {
      status: "unhealthy",
      message: `Stagehand Error: ${error.message}`,
    };
    healthCheck.status = "unhealthy";
  }

  // Send response with appropriate status code
  res.status(healthCheck.status === "healthy" ? 200 : 503).json(healthCheck);
});

export default router;
