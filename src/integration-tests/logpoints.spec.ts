/*********************************************************************
 * Copyright (c) 2019 Arm and others
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/

import { join } from 'path';
import { expect } from 'chai';
import { CdtDebugClient } from './debugClient';
import {
    fillDefaults,
    gdbAsync,
    isRemoteTest,
    standardBeforeEach,
    testProgramsDir,
} from './utils';

describe('logpoints', async () => {
    let dc: CdtDebugClient;

    beforeEach(async function () {
        dc = await standardBeforeEach();

        await dc.launchRequest(
            fillDefaults(this.currentTest, {
                program: join(testProgramsDir, 'count'),
            })
        );
    });

    afterEach(async () => {
        // Fix race condition discussed in
        // https://github.com/eclipse-cdt-cloud/cdt-gdb-adapter/pull/339#pullrequestreview-2427636654:
        // logpoints
        if (!gdbAsync && isRemoteTest) {
            const waitForContinued = dc.waitForEvent('continued');
            const threads = await dc.threadsRequest();
            const pr = dc.continueRequest({
                threadId: threads.body.threads[0].id,
            });
            await Promise.all([pr, waitForContinued]);
        }

        await dc.stop();
    });

    it('hits a logpoint', async () => {
        const logMessage = 'log message';

        await dc.setBreakpointsRequest({
            source: {
                name: 'count.c',
                path: join(testProgramsDir, 'count.c'),
            },
            breakpoints: [
                {
                    column: 1,
                    line: 4,
                    logMessage,
                },
            ],
        });
        await dc.configurationDoneRequest();
        const logEvent = await dc.waitForOutputEvent('console');
        expect(logEvent.body.output).to.eq(logMessage);
    });

    it('supports changing log messages', async () => {
        const logMessage = 'log message';

        await dc.setBreakpointsRequest({
            source: {
                name: 'count.c',
                path: join(testProgramsDir, 'count.c'),
            },
            breakpoints: [
                {
                    column: 1,
                    line: 4,
                    logMessage: 'something uninteresting',
                },
            ],
        });
        await dc.setBreakpointsRequest({
            source: {
                name: 'count.c',
                path: join(testProgramsDir, 'count.c'),
            },
            breakpoints: [
                {
                    column: 1,
                    line: 4,
                    logMessage,
                },
            ],
        });
        await dc.configurationDoneRequest();
        const logEvent = await dc.waitForOutputEvent('console');
        expect(logEvent.body.output).to.eq(logMessage);
    });
});
