import { env } from 'process';
import { createClient } from 'redis';

const REDIS_URL = env.REDIS_URL || undefined;
const client = createClient({
    url: REDIS_URL
});

client.connect();

export default client;
