# tiny-stack-vm entry

`main.ts` (Node 22, standard library only) reads every instance from MAKEFUN_INPUT_DIR,
runs each program on make.fun's tiny stack ISA (kit ISA.md), and writes
`/output/<id>/stdout.bin` plus `/output/<id>/exit.txt` with the exit code.

Verified against the kit's 40 practice instances: 40/40 stdout byte-identical to the
reference VM and 40/40 exit codes, deterministic across runs. The house baseline
plain-vm 1.0.0 scores 6700/40000 on the same set; this entry scores 40000/40000.
