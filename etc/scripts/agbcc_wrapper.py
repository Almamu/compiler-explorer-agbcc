#!/usr/bin/env python3
from pathlib import Path

import subprocess
import argparse

parser = argparse.ArgumentParser(description='AGBCC Wrapper')
parser.add_argument('--compiler', action='store', help='The base path to the actual AGBCC compiler', required=True, dest='compiler')
parser.add_argument('--input', action='store', help='The input file to compile', required=True, dest='input')
parser.add_argument('--output', action='store', help='The output file to compile', required=True, dest='output')
parser.add_argument('remainder', nargs=argparse.REMAINDER)

args = parser.parse_args()

assemblerOutput = str(Path(args.output).with_suffix('.o'))
output = Path(args.output)
compiler = str(Path(args.compiler).parent.parent)
args.remainder.pop(0)

# build subprocess commands and pipe them
# objdump will be the one to write to the output
with open(args.output, 'w') as output:
    cpp = subprocess.Popen(['arm-none-eabi-cpp', '-I', compiler + '/include', '-iquote', 'include', '-nostdinc', '-undef', args.input], stdout=subprocess.PIPE)
    translation = subprocess.Popen([compiler + '/bin/agbcc', '-g', *args.remainder], stdin=cpp.stdout, stdout=subprocess.PIPE)
    assembler = subprocess.Popen(['arm-none-eabi-as', '-mcpu=arm7tdmi', '-mthumb-interwork', '-o', assemblerOutput], stdin=translation.stdout)
    assembler.wait()

    objdump = subprocess.Popen(['arm-none-eabi-objdump', '-d', '-l', '-C', '--no-addresses', '--no-show-raw-insn', assemblerOutput], stdin=assembler.stdout, stdout=output)
    objdump.wait()
