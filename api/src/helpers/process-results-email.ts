import sgMail from '@sendgrid/mail';
import { VideoProcessingStatus } from '../enums/video-processing-status.enum';
import { requireEnv } from './utilities';

type ProcessResultsEmailInput = {
    to: string;
    videoProcessingId: string;
    videoUrl: string;
    status: string;
    resultData: unknown;
};

export const sendProcessResultsEmailMessage = async ({
    to,
    videoProcessingId,
    videoUrl,
    status,
    resultData
}: ProcessResultsEmailInput): Promise<void> => {
    sgMail.setApiKey(requireEnv('SENDGRID_API_KEY'));

    const fromEmail = requireEnv('SENDGRID_FROM_EMAIL');
    const fromName = process.env.SENDGRID_FROM_NAME?.trim();
    const formattedResultData = JSON.stringify(resultData, null, 2);
    const normalizedStatus = status.trim().toUpperCase();
    const statusTheme = getStatusTheme(normalizedStatus);
    const escapedVideoUrl = escapeHtml(videoUrl);
    const escapedVideoProcessingId = escapeHtml(videoProcessingId);
    const escapedStatus = escapeHtml(normalizedStatus);
    const escapedFormattedResultData = escapeHtml(formattedResultData);

    await sgMail.send({
        to,
        from: fromName ? { email: fromEmail, name: fromName } : fromEmail,
        subject: `Video processing results: ${videoProcessingId}`,
        text: [
            'Your video processing request has finished.',
            '',
            `Video processing ID: ${videoProcessingId}`,
            `Status: ${status}`,
            `Video URL: ${videoUrl}`,
            '',
            'Results:',
            formattedResultData
        ].join('\n'),
        html: `
            <div style="margin:0;padding:32px 16px;background:linear-gradient(180deg,#f4efe6 0%,#f7f7f5 100%);font-family:Georgia,'Times New Roman',serif;color:#1f2937;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:720px;margin:0 auto;">
                    <tr>
                        <td style="padding:0;">
                            <div style="background:#153243;border-radius:24px 24px 0 0;padding:28px 32px;color:#f8fafc;">
                                <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.8;margin-bottom:12px;">Video Intel Engine</div>
                                <div style="font-size:30px;line-height:1.2;font-weight:bold;margin-bottom:10px;">Your video processing report is ready</div>
                                <div style="font-size:16px;line-height:1.6;color:#d7e3ea;">
                                    We finished processing your video and prepared the latest results for review.
                                </div>
                            </div>
                            <div style="background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 24px 24px;padding:32px;">
                                <div style="margin-bottom:24px;">
                                    <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:${statusTheme.background};color:${statusTheme.text};font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;">
                                        ${escapedStatus}
                                    </span>
                                </div>

                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 12px;margin-bottom:28px;">
                                    <tr>
                                        <td style="width:180px;padding:14px 16px;background:#f8fafc;border-radius:14px 0 0 14px;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Video processing ID</td>
                                        <td style="padding:14px 16px;background:#f8fafc;border-radius:0 14px 14px 0;font-size:15px;color:#0f172a;">${escapedVideoProcessingId}</td>
                                    </tr>
                                    <tr>
                                        <td style="width:180px;padding:14px 16px;background:#f8fafc;border-radius:14px 0 0 14px;font-size:12px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Video URL</td>
                                        <td style="padding:14px 16px;background:#f8fafc;border-radius:0 14px 14px 0;font-size:15px;color:#0f172a;word-break:break-word;">
                                            <a href="${escapedVideoUrl}" style="color:#0f766e;text-decoration:none;">${escapedVideoUrl}</a>
                                        </td>
                                    </tr>
                                </table>

                                <div style="margin-bottom:24px;">
                                    <a href="${escapedVideoUrl}" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:14px 22px;border-radius:12px;">
                                        Open video
                                    </a>
                                </div>

                                <div style="margin-bottom:12px;font-size:12px;font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;color:#64748b;">
                                    Process results
                                </div>
                                <div style="background:#111827;border-radius:18px;padding:20px;overflow:auto;">
                                    <pre style="margin:0;white-space:pre-wrap;word-break:break-word;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:13px;line-height:1.7;color:#d1fae5;">${escapedFormattedResultData}</pre>
                                </div>

                                <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;font-size:13px;line-height:1.7;color:#6b7280;">
                                    This email was generated automatically by Video Intel Engine for video processing request <strong style="color:#374151;">${escapedVideoProcessingId}</strong>.
                                </div>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>
        `
    });
};

const getStatusTheme = (status: string): { background: string; text: string; } => {
    switch (status) {
        case VideoProcessingStatus.COMPLETED:
            return { background: '#dcfce7', text: '#166534' };
        case VideoProcessingStatus.FAILED:
            return { background: '#fee2e2', text: '#991b1b' };
        case VideoProcessingStatus.PROCESSING:
            return { background: '#dbeafe', text: '#1d4ed8' };
        default:
            return { background: '#fef3c7', text: '#92400e' };
    }
};

const escapeHtml = (value: string): string => {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};
