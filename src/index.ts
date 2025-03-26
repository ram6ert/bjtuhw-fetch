import { env } from "process";
import express, { type Request, type Response } from "express";
import users from "./users";

const PORT = parseInt(env.PORT?? '3000');
const HOSTNAME = env.HOSTNAME?? 'localhost';

const app = express();
app.set('trust proxy', 'loopback');
app.use(express.json());

app.use("/users", users);
app.use((err: any, _req: Request, res: Response, _next: Function) => {
    console.error(err);
    res.status(500).end('Internal Server Error');
});

app.listen(PORT, HOSTNAME, err => {
    if(err) {
        console.error(err);
    } else {
        console.log(`Listening on http://${HOSTNAME}:${PORT}`);;
    }
});
