// Copyright (c) 2023, Compiler Explorer Authors
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
//     * Redistributions of source code must retain the above copyright notice,
//       this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
// ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

import path from 'node:path';
import {splitArguments} from '../../shared/common-utils.js';
import {ExecutionOptions} from '../../types/compilation/compilation.interfaces.js';
import {ConfiguredOverrides} from '../../types/compilation/compiler-overrides.interfaces.js';
import {UnprocessedExecResult} from '../../types/execution/execution.interfaces.js';
import {ParseFiltersAndOutputOptions} from '../../types/features/filters.interfaces.js';
import {SelectedLibraryVersion} from '../../types/libraries/libraries.interfaces.js';
import {BaseCompiler} from '../base-compiler.js';

export class AGBCC extends BaseCompiler {
    static get key() {
        return 'agbcc';
    }

    override prepareArguments(
        userOptions: string[],
        filters: ParseFiltersAndOutputOptions,
        backendOptions: Record<string, any>,
        inputFilename: string,
        outputFilename: string,
        libraries: SelectedLibraryVersion[],
        overrides: ConfiguredOverrides,
    ) {
        // set preProcessLines to add .loc hints for compiler explorer
        filters.preProcessLines = this.preProcessLines.bind(this);

        return [
            '--compiler',
            this.compiler.exe,
            ...splitArguments(this.compiler.options),
            '--input',
            this.filename(inputFilename),
            '--output',
            this.filename(outputFilename),
            '--',
            ...userOptions,
        ];
    }
    override async exec(
        filepath: string,
        args: string[],
        execOptions: ExecutionOptions,
    ): Promise<UnprocessedExecResult> {
        // filepath is ignored as we want to wrap it with our little tool
        return super.exec(path.join(process.cwd(), 'etc/scripts/agbcc_wrapper.py'), args, execOptions);
    }

    preProcessLines(asmLines: string[]) {
        let i = 0;

        // remove the first 5 lines as they're part of the objdump output
        asmLines.splice(0, 7);
        const files: string[] = [];

        while (i < asmLines.length) {
            // Regex for determining the file line and column of the following source lines
            const match = asmLines[i].match(/^(.+\.c):(\d+)$/);
            i++;
            if (match) {
                // convert the line into a comment too
                asmLines[i - 1] = '@ ' + asmLines[i - 1] + ':';
                let fileIndex = files.indexOf(match[1]);

                if (fileIndex === -1) {
                    fileIndex = files.length;
                    files.push(match[1]);
                }

                // adjust to the right index
                fileIndex++;

                // Add two lines stating the file and location to allow parsing the source location by the standard
                // parser
                asmLines.splice(i, 0, '\t.loc ' + fileIndex + ' ' + match[2] + ' 0');
                i++;
            }
        }

        // add files directive to the beginning
        asmLines.unshift(...files.map((file, index) => '\t.file ' + (index + 1) + ' "' + file + '"'));

        return asmLines;
    }
}
