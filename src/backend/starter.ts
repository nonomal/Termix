//  npx tsc -p tsconfig.node.json
//  node ./dist/backend/starter.js

import './db/database.js'
import './ssh/ssh.js';
import chalk from 'chalk';

const fixedIconSymbol = '🚀';

const getTimeStamp = (): string => {
    return chalk.gray(`[${new Date().toLocaleTimeString()}]`);
};

const formatMessage = (level: string, colorFn: chalk.Chalk, message: string): string => {
    return `${getTimeStamp()} ${colorFn(`[${level.toUpperCase()}]`)} ${chalk.hex('#1e3a8a')(`[${fixedIconSymbol}]`)} ${message}`;
};

const logger = {
    info: (msg: string): void => {
        console.log(formatMessage('info', chalk.cyan, msg));
    },
    warn: (msg: string): void => {
        console.warn(formatMessage('warn', chalk.yellow, msg));
    },
    error: (msg: string, err?: unknown): void => {
        console.error(formatMessage('error', chalk.redBright, msg));
        if (err) console.error(err);
    },
    success: (msg: string): void => {
        console.log(formatMessage('success', chalk.greenBright, msg));
    },
    debug: (msg: string): void => {
        if (process.env.NODE_ENV !== 'production') {
            console.debug(formatMessage('debug', chalk.magenta, msg));
        }
    }
};

(async () => {
    try {
        logger.info("Starting all backend servers...");

        logger.success("All servers started successfully");

        process.on('SIGINT', () => {
            logger.info("Shutting down servers...");
            process.exit(0);
        });
    } catch (error) {
        logger.error("Failed to start servers:", error);
        process.exit(1);
    }
})();