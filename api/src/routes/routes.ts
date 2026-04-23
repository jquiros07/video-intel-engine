import { Router } from "express";
import { parseVideoUpload } from "../middlewares/parse-video-upload.middleware";
import { validateToken } from "../middlewares/validate-token.middleware";
import { validateServiceSecret } from "../middlewares/validate-service-secret.middleware";
import { rateLimit } from "express-rate-limit";
import { requestAccessToken } from "../controllers/access.controller";
import { processVideo, sendProcessResultsEmail } from "../controllers/video-process.controller";

const requestAccessRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 5 minutes
    max: 10,
    message: 'Too many requests, please try again later.'
});

const router = Router();

router.post("/request-access-token", requestAccessRateLimiter, requestAccessToken);
router.post("/process-video", validateToken, parseVideoUpload, processVideo);
router.post("/send-email", validateToken, sendProcessResultsEmail);
router.post("/internal/send-email", validateServiceSecret, sendProcessResultsEmail);

export default router;
