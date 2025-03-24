import express from 'express'
import redis from './redis';
import getHomeworks from './hw';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const router = express.Router();

router.get('/:id/homework', async (req, res) => {
    if(!/^\d{8}$/.test(req.params.id)) {
        res.status(401).end();
    }
    const hw = await redis.hGet(`user:${req.params.id}`, 'homework');
    if(hw) {
        res.type('application/json').end(hw);
    } else {
        const hw = await getHomeworks(req.params.id);
        redis.hSet(`user:${req.params.id}`, 'homework', JSON.stringify(hw));
        res.json(hw).end();
    }
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
    const hw = await getHomeworks(req.params.id);
    await redis.hSet(`user:${req.params.id}`, 'homework', JSON.stringify(hw));
    res.status(204).end();
});

export default router;
