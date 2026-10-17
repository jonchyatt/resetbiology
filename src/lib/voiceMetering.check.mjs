import assert from 'node:assert/strict';
import { reserveVoiceMinute } from './voiceMetering.ts';

let balance = 1;
const prisma = {
    user: {
        async updateMany({ where, data }) {
            if (where.id !== 'member-1' || balance < where.voiceMinutesRemaining.gte) {
                return { count: 0 };
            }
            balance -= data.voiceMinutesRemaining.decrement;
            return { count: 1 };
        },
        async findUnique({ where }) {
            return where.id === 'member-1' ? { voiceMinutesRemaining: balance } : null;
        },
    },
};

assert.equal(await reserveVoiceMinute(prisma, 'member-1'), 0);
assert.equal(await reserveVoiceMinute(prisma, 'member-1'), null);
assert.equal(balance, 0);
console.log('voice metering: PASS');