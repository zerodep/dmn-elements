import nock from 'nock';

import 'chai/register-expect.js';

process.env.NODE_ENV = 'test';
Error.stackTraceLimit = 50;

nock.enableNetConnect(/localhost|127\.0\.0\.1/);
