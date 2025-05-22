import express from "express";
import cors from "cors";
import costingRoutes from "./routes/costing.js";
import healthRoutes from "./routes/health.js";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/v1", costingRoutes);
app.use("/health", healthRoutes);
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
  }
);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
