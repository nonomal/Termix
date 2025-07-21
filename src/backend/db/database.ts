import express from 'express';
import bodyParser from 'body-parser';
import userRoutes from './routes/users.js';
import sshRoutes from './routes/ssh.js';
import sshTunnelRoutes from './routes/ssh_tunnel.js';
import chalk from 'chalk';
import cors from 'cors';

// Custom logger (adapted from starter.ts, with a database icon)
const dbIconSymbol = '🗄️';
const getTimeStamp = (): string => chalk.gray(`[${new Date().toLocaleTimeString()}]`);
const formatMessage = (level: string, colorFn: chalk.Chalk, message: string): string => {
    return `${getTimeStamp()} ${colorFn(`[${level.toUpperCase()}]`)} ${chalk.hex('#1e3a8a')(`[${dbIconSymbol}]`)} ${message}`;
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

const app = express();

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(bodyParser.json());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/users', userRoutes);
app.use('/ssh', sshRoutes);
app.use('/ssh_tunnel', sshTunnelRoutes);

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
});

// Start server
const PORT = 8081;
app.listen(PORT);