# Git & Pull Request Workflow Rule

Always follow this Git workflow when developing and delivering changes in this repository:

1. **Development & Editing Phase**:
   - Make code edits and improvements directly in the working tree without prematurely creating new git branches or committing.
   - Test and verify changes in the development environment (`npm run dev`).

2. **Branch Creation Trigger**:
   - **Only create a new branch when the user explicitly accepts changes and instructs to commit/sync/push.**
   - Do not create or switch branches during the initial code editing phase.

3. **Commit & PR Workflow Execution (When User Triggers Commit)**:
   - Create and checkout the dedicated branch (`git checkout -b <branch-name>` e.g., `feat/...`, `fix/...`, `refactor/...`).
   - Run `npm run build` to verify clean compilation and update production asset manifests.
   - Stage all modified and generated files (`git add .`).
   - Commit with a clear Conventional Commit message (`feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)`).
   - Push the branch to `origin` (`git push -u origin <branch-name>`).
   - Never push directly to `main`.

4. **Response Format**:
   - Always format the final response with:
     - 🌿 **Git Branch & Pull Request Link**: Clickable markdown link to create/view the PR on GitHub (`https://github.com/SamerBerjawi/Crystal/pull/new/<branch-name>`).
     - 📋 **Executive Summary**: Brief high-level summary of what was accomplished.
     - 🛠️ **Detailed Breakdown of Changes**: Grouped by component/area.
     - 📁 **Files Modified & Created**: List of modified files with clickable markdown links (`file:///...`).
     - ✅ **Verification & Build Status**: Confirmation of production build results (`npm run build`).
