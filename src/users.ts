import express from 'express'
import redis from './redis';
import getHomeworks, { type Homework } from './hw';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const router = express.Router();

async function forceFetchAllHomework(id: string): Promise<Homework[]> {
    const hw = await getHomeworks(id);
    await redis.set(`homework:${id}`, JSON.stringify(hw), {EX: 12 * 60 * 60 * 1000});
    return hw;
}

async function fetchAllHomework(id: string): Promise<Homework[]> {
    const hw = await redis.get(`homework:${id}`);
    if(hw) {
        return JSON.parse(hw);
    } else {
        return await forceFetchAllHomework(id);
    }
}

router.get('/:id/homework', async (req, res) => {
    if(!/^\d{8}$/.test(req.params.id)) {
        res.status(401).end();
    }

    res.json(await fetchAllHomework(req.params.id)).end();
});

router.use('/:id/homework/refresh', rateLimit(
    {
        windowMs: 15 * 60 * 1000,
        limit: 5,
        store: new RedisStore({ prefix: 'rate-limit:', sendCommand:(...args) => redis.sendCommand(args) }),
    }
))

router.post('/:id/homework/refresh', async (req, res) => {
    if(!/^\d{8}$/.test(req.params.id)) {
        res.status(401).end();
    }
    await forceFetchAllHomework(req.params.id)
    res.status(204).end();
});

export default router;
