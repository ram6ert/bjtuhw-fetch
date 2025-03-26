import express from 'express'
import redis from './redis';
import getHomework, { type Homework } from './hw';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const router = express.Router();

export type HomeworkResult = {
    homework: SerializedHomework[],
    last_update: string;
}

export type SerializedHomework = {
    course_name: string,
    title: string,
    content: string,
    open_at?: string,
    end_at?: string,
    create_at?: string,
};

function serializeHomework(homework: Homework): SerializedHomework {
    return {
        end_at: homework.endAt?.toISOString(),
        create_at: homework.createAt?.toISOString(),
        open_at: homework.openAt?.toISOString(),
        course_name: homework.courseName,
        content: homework.content,
        title: homework.title,
    };
}

function unserializeHomework(homework: SerializedHomework): Homework {
    return {
        endAt: homework.end_at? new Date(homework.end_at) : null,
        createAt: homework.create_at? new Date(homework.create_at) : null,
        openAt: homework.open_at? new Date(homework.open_at) : null,
        courseName: homework.course_name,
        content: homework.content,
        title: homework.title,
    };
}

async function forceFetchAllHomework(id: string): Promise<HomeworkResult> {
    const last_update = new Date();
    const homework = (await getHomework(id)).map(val => serializeHomework(val));
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
        const originalHomework = homeworkResult.homework.map(val => unserializeHomework(val));
        const filteredHomework = originalHomework.filter(val => !val.endAt || val.endAt > now);
        if(filteredHomework.length !== originalHomework.length) {
            homeworkResult.homework = filteredHomework.map(val => serializeHomework(val));
            await redis.set(`homework:${id}`, JSON.stringify(homeworkResult), { KEEPTTL: true });
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
