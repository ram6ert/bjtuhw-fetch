import axios from 'axios';
import crypto from 'crypto';

const BASE_URL = 'http://123.121.147.7:88/';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
};

// 作业类型定义
export type Homework = {
    courseName: string,
    title: string,
    content: string,
    openAt: Date | null,
    endAt: Date | null,
    createAt: Date | null,
}

function parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr.length === 0) {
        return null;
    }

    try {
        const date = new Date(dateStr.replace(' ', 'T') + '+08:00');
        if (isNaN(date.getTime())) {
            return null;
        }
        return date;
    } catch (error) {
        return null;
    }
}

export async function getHomeworks(studentId: string): Promise<Homework[]> {
    // 创建带cookie支持的axios实例
    const client = axios.create({
        baseURL: BASE_URL,
        headers: HEADERS,
        withCredentials: true
    });

    // 生成密码hash
    const password = `Bjtu@${studentId}`;
    const passwordHash = crypto.createHash('md5').update(password).digest('hex');

    // 登录过程
    try {
        // 获取初始cookie
        const initialResp = await client.get('/ve/');
        client.defaults.headers['Cookie'] = initialResp.headers['set-cookie'] || '';

        // 获取验证码
        await client.get('/ve/GetImg');
        const passcodeResp = await client.get('/ve/confirmImg');
        const passcode = passcodeResp.data;

        // 执行登录
        const loginResp = await client.post('/ve/s.shtml', new URLSearchParams({
            'login': 'main_2',
            'qxkt_type': '',
            'qxkt_url': '',
            'username': studentId,
            'password': passwordHash,
            'passcode': passcode.toString()
        }), {
            headers: {
                ...HEADERS,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        // 检查登录是否成功
        if (loginResp.status < 200 || loginResp.status >= 300 || (loginResp.data as string).includes('alert(')) {
            throw new Error(`Login failed for ${studentId}`);
        }

        // 获取当前学期
        const semResp = await client.get('/ve/back/rp/common/teachCalendar.shtml', {
            params: { 'method': 'queryCurrentXq' }
        });

        const currentSem = semResp.data.result[0];
        const semId = currentSem.xqCode.toString();

        // 获取课程列表
        const courseResp = await client.get('/ve/back/coursePlatform/course.shtml', {
            params: {
                'method': 'getCourseList',
                'pagesize': '100',
                'page': '1',
                'xqCode': semId
            }
        });

        const courseList = courseResp.data.courseList;

        type Course = {
            id: string, name: string
        };

        const courses: Course[] = courseList.map((course: any) => ({
            id: course.id,
            name: course.name
        }));

        // 获取所有课程的作业
        let allHomeworks: Homework[] = [];

        const fetchHomeworkSubType = async (course: Course, subType: string) => {
            try {
                const homeworkResp = await client.get('/ve/back/coursePlatform/homeWork.shtml', {
                    params: {
                        'method': 'getHomeWorkList',
                        'cId': course.id,
                        'subType': subType.toString(),
                        'page': '1',
                        'pagesize': '50'
                    }
                });

                const homeworkData = homeworkResp.data;

                const result = [];
                if (homeworkData.total > 0) {
                    const homeworks = homeworkData.courseNoteList;

                    // 筛选未提交的作业
                    for (const homework of homeworks) {
                        if (!homework.subTime) {
                            result.push({
                                courseName: homework.course_name,
                                openAt: parseDate(homework.open_date),
                                endAt: parseDate(homework.end_time),
                                createAt: parseDate(homework.create_date),
                                title: homework.title,
                                content: homework.content
                            });
                        }
                    }
                }

                return result;
            }
            catch (error) {
                console.error((error as any).message);
                throw error;
            }
        };

        const promises = [];
        for (const course of courses) {
            // 获取不同子类型的作业
            for (let subType = 0; subType < 5; subType++) {
                promises.push(fetchHomeworkSubType(course, subType.toString()));
            }
        }

        const allHomeworkArray = await Promise.all(promises);
        for(const homeworkArray of allHomeworkArray) {
            allHomeworks = allHomeworks.concat(homeworkArray);
        }

        // 过滤截止日期在当前时间之后的作业
        const now = new Date();
        return allHomeworks.filter(homework => !homework.endAt || homework.endAt > now);

    } catch (error) {
        throw new Error(`Failed to fetch homework for ${studentId}.\n${(error as any).message?? error}`);
    }
}

export default getHomeworks;