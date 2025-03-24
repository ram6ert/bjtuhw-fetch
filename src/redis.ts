import { env } from 'process';
import { createClient } from 'redis';

const REDIS_URL = 'redis://127.0.0.1:6379/2';//env.REDIS_URL || undefined;
const client = createClient({
    url: REDIS_URL
});

client.connect();

export default client;
