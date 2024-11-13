/*********************************************************************
 * Copyright (c) 2022 Kichwa Coders Canada Inc. and others.
 *
 * This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License 2.0
 * which is available at https://www.eclipse.org/legal/epl-2.0/
 *
 * SPDX-License-Identifier: EPL-2.0
 *********************************************************************/
import { CdtDebugClient } from './debugClient';
import {
    standardBeforeEach,
    testProgramsDir,
    resolveLineTagLocations,
    isRemoteTest,
    gdbNonStop,
    fillDefaults,
    gdbAsync,
} from './utils';
import { assert, expect } from 'chai';
import * as path from 'path';
import * as os from 'os';

describe('multithread', async function () {
    let dc: CdtDebugClient;
    const program = path.join(testProgramsDir, 'MultiThread');
    const source = path.join(testProgramsDir, 'MultiThread.cc');

    const lineTags = {
        LINE_MAIN_ALL_THREADS_STARTED: 0,
        LINE_THREAD_IN_HELLO: 0,
    };

    before(function () {
        resolveLineTagLocations(source, lineTags);
    });

    beforeEach(async () => {
        dc = await standardBeforeEach();
    });

    afterEach(async () => {
        await dc.stop();
    });

    it('async resume for gdb-non-stop off', async function () {
        if (gdbNonStop) {
            // This test is covering only gdb-non-stop off mode
            this.skip();
        } else if (os.platform() === 'win32' && (!isRemoteTest || !gdbAsync)) {
            // Only supported in win32 host with remote + mi-async targets
            this.skip();
        }

        await dc.launchRequest(
            fillDefaults(this.test, {
                program,
            })
        );
        await dc.setBreakpointsRequest({
            source: {
                path: source,
            },
            breakpoints: [
                {
                    line: lineTags['LINE_MAIN_ALL_THREADS_STARTED'],
                },
                {
                    line: lineTags['LINE_THREAD_IN_HELLO'],
                },
            ],
        });

        await dc.configurationDoneRequest();
        await dc.waitForEvent('stopped');

        const threads = await dc.threadsRequest();

        // make sure that there is at least 2 threads.
        expect(threads.body.threads).length.greaterThanOrEqual(2);

        // Send continue to thread 2
        dc.send('cdt-gdb-tests/executeCommand', {
            command: '-exec-continue --thread 2',
        });

        const event = await dc.waitForEvent('continued');

        // In allThreadsContinued:true case we are expecting id of the first thread no matter which thread is continued
        assert.deepEqual(event.body, {
            threadId: threads.body.threads[0].id,
            allThreadsContinued: true,
        });
    });
});
