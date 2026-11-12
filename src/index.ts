import express, { type Application, type Request, type Response } from 'express';
import dotenv from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser';

dotenv.config();
const app: Application = express();

app.use(cors({
    origin: (_origin, callback) => callback(null, true),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'cache-control',
        'remember-me'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method}`);
    next();
});


/**
 * @route test router
 */
app.get("/", (_req: Request, rest: Response) => {
    rest.json({
        message: "Server is Running"
    })
}
)
export default app;