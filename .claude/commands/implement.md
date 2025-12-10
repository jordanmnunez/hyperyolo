# hyperyolo Implementation Session

You are implementing the hyperyolo CLI wrapper. Work through tasks systematically using test-driven development (TDD).

## Workflow

1. **Pick the next unblocked task** from the MVP epic:
   ```bash
   bd list --status open --labels mvp
   ```
   Choose a task where all dependencies are completed. Check dependencies with:
   ```bash
   bd show <task-id>
   ```

2. **Mark task in-progress**:
   ```bash
   bd update <task-id> --status in-progress
   ```

3. **Follow TDD cycle** for each task:

   ### RED: Write failing tests first
   - Create test file in `tests/` mirroring source structure
   - Write tests that define expected behavior
   - Run tests to confirm they fail:
     ```bash
     npm test -- --run <test-file>
     ```

   ### GREEN: Write minimal implementation
   - Implement just enough code to make tests pass
   - Follow patterns in existing code (check `src/adapters/types.ts`, `src/core/`)
   - Run tests to confirm they pass

   ### REFACTOR: Clean up
   - Improve code quality without changing behavior
   - Ensure tests still pass

4. **Verify implementation** against task requirements:
   - Re-read task description: `bd show <task-id>`
   - Check all acceptance criteria met
   - Run full test suite: `npm test`

5. **Mark task complete**:
   ```bash
   bd update <task-id> --status closed
   ```

6. **Repeat** with next unblocked task

7. **Commit your changes** when all tasks are complete:
   - Stage and commit all implementation work
   - Use a descriptive commit message summarizing what was implemented

## Key References

- **Adapter interface**: `src/adapters/types.ts` (source of truth)
- **CLI flags**: `docs/ai-cli-comparison.md`
- **CLI verification**: `docs/research/cli-verification/*.md`
- **Version compatibility**: `docs/cli-compatibility.md`

## Important Patterns

### Adapters must:
- Return `AvailabilityResult` from `isAvailable()` (not boolean)
- Return `CommandBuildResult` from `buildCommand()` (not string[])
- Handle version parsing failures gracefully
- Never throw from `isAvailable()`

### CLI-specific quirks:
- **Codex**: No `--yolo` flag; use `--dangerously-bypass-approvals-and-sandbox`
- **Claude**: `--output-format stream-json` REQUIRES `--verbose`
- **Gemini**: `-y` does NOT auto-enable sandbox

### Testing:
- Use mock fixtures from `tests/mocks/`
- Mock `execa` for subprocess tests
- Test both success and error paths

## Current Task Queue (Phase Order)

Phase 0 (no deps - start here):
- `hyperyolo-15h`: package.json
- `hyperyolo-s9p`: tsconfig

Phase 1 (needs Phase 0):
- `hyperyolo-6l8`: stream tee pipeline
- `hyperyolo-kfs`: signal forwarding
- `hyperyolo-6rd`: session ID parsers
- `hyperyolo-hju`: mock CLI fixtures

Phase 2 (needs Phase 1):
- `hyperyolo-hed`: Codex adapter
- `hyperyolo-p97`: Claude adapter
- `hyperyolo-bwn`: Gemini adapter
- `hyperyolo-afa`: adapter registry

Phase 3 (needs Phase 2):
- `hyperyolo-sja`: Commander entry point
- `hyperyolo-2k0`: codex command
- `hyperyolo-mmc`: claude command
- `hyperyolo-7s1`: gemini command
- `hyperyolo-9sx`: commands index

Phase 4 (parallel, needs Phase 0):
- `hyperyolo-bsf`: theme module
- `hyperyolo-scx`: banner component
- `hyperyolo-5r8`: footer component
- `hyperyolo-9ox`: UI index

Phase 5 (needs Phase 3 + 4):
- `hyperyolo-10g`: adapter unit tests
- `hyperyolo-55e`: executor unit tests
- `hyperyolo-ss6`: session store tests
- `hyperyolo-qmy`: integration tests
- `hyperyolo-xoh`: bin setup

---

Start by running `bd list --status open --labels phase-0` to find the first task.
