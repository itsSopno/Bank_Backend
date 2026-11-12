import dotenv from 'dotenv';
dotenv.config();
import app from '../index.js';
import { testDBConnection } from '../config/server.js';

const port = process.env.PORT || 5000;

const startEngine = async () => {
    try {
        await testDBConnection();
        app.listen(port, () => {

            console.log(`Server is running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error("Failed to start engine", error);
        process.exit(1);
    }
}

startEngine()