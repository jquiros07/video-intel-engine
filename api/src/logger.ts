import pino from 'pino';

const transport = pino.transport({
    target: 'pino/file',
    options: { destination: '/app/logs/api.log', mkdir: true },
});

export const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' }, transport);
