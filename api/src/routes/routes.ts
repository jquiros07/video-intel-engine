import express, { Router } from "express";
import { validateToken } from "../middlewares/validate-token.middleware";
import { rateLimit } from "express-rate-limit";
import { requestAccessToken } from "../controllers/access.controller";
import { processVideo } from "../controllers/video-process.controller";

const requestAccessRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 5 minutes
    max: 10,
    message: 'Too many requests, please try again later.'
});

const router = Router();
const videoUploadParser = express.raw({
    type: ['video/*', 'application/octet-stream'],
    limit: process.env.VIDEO_UPLOAD_PARSER_LIMIT || '1gb'
});

router.post("/request-access-token", requestAccessRateLimiter, requestAccessToken);
router.post("/process-video", validateToken, videoUploadParser, processVideo);

export default router;
