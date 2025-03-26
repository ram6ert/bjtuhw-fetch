import express from 'express'
import redis from './redis';
import getHomeworks, { type Homework } from './hw';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const router = express.Router();

export type HomeworkResult = {
    homework: Homework[],
    last_update: string;
}

async function forceFetchAllHomework(id: string): Promise<HomeworkResult> {
    const last_update = new Date();
    const homework = await getHomeworks(id);
    const content = {
        homework, last_update: last_update.toISOString()
    };
    await redis.set(`homework:${id}`, JSON.stringify(content), {EX: 12 * 60 * 60 * 1000});
    return content;
}

async function fetchAllHomework(id: string): Promise<HomeworkResult> {
    const hw = await redis.get(`homework:${id}`);
    if(hw) {
        const homeworkResult = JSON.parse(hw) as HomeworkResult;

        const now = new Date();
        const originalHomework = homeworkResult.homework;
        const filteredHomework = originalHomework.filter(val => {
            if(!val.endAt) {
                return true;
            } else {
                return val.endAt >= now;
            }
        });
        if(filteredHomework.length !== originalHomework.length) {
            homeworkResult.homework = filteredHomework;
            await redis.set(`homework:${id}`, JSON.stringify(homeworkResult));
        }
        return homeworkResult;
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
