# Ownership and Boundaries

## Branch
Use only the assigned feature branch named in `BRANCH.md`. Never commit directly to `main`.

## Shared contracts
`source-frontend/src/services/contracts.ts`, `source-frontend/src/types/relay.ts`, `source-frontend/src/services/index.ts`, protocol documents and shared UI files are shared integration surfaces. Do not change them silently. If a necessary additive contract change is discovered:
1. Stop before depending on it.
2. Document the gap and proposed change in your branch.
3. Ask the coordinator to approve and land the smallest change on `main`.
4. Rebase/merge your feature branch and continue.

## File ownership
Only modify the subsystem files listed in this ZIP. Prefer new isolated modules/adapters and tests. Do not edit another contributor's owned files. The coordinator owns shared contracts, merge sequencing and final integration.

## No fake completion
Mocks can remain for UI development and unit tests, but production paths must not report mock results as real. Clearly label unsupported capabilities.
