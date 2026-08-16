# Git & Pull Request Workflow Rule

Always follow this Git workflow when developing and delivering changes in this repository:

1. **Development & Editing Phase**:
   - Make code edits and improvements directly in the working tree without prematurely creating new git branches or committing.
   - Test and verify changes in the development environment (`npm run dev` and `npm run lint`).

2. **Branch Creation Trigger (On "Sync Changes" or Commit Request)**:
   - **Whenever the user presses "Sync Changes", instructs to sync, commits, or pushes changes, ALWAYS create a new dedicated feature/fix branch.**
   - Do NOT commit or push directly to previously reused branches or to `main`.
   - Choose a clear, descriptive branch name based on the task just completed (e.g., `feat/<feature-name>`, `fix/<issue-name>`, `refactor/<target>`).

3. **Commit & PR Workflow Execution (When User Triggers Commit / Sync)**:
   - Create and checkout the dedicated new branch:
     ```bash
     git checkout -b <new-branch-name>
     ```
   - Run `npm run build` to verify clean compilation and update production asset bundles and versioning.
   - Stage all modified and generated files:
     ```bash
     git add .
     ```
   - Commit with a clear Conventional Commit message (`feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)`).
   - Push the new branch to GitHub:
     ```bash
     git push -u origin <new-branch-name>
     ```

4. **Response Format**:
   - Always format the response with:
     - 🌿 **Git Branch & Pull Request Link**: Clickable markdown link to create/view the PR on GitHub (`https://github.com/SamerBerjawi/Crystal/pull/new/<new-branch-name>`).
     - 📋 **Executive Summary**: Brief high-level summary of what was accomplished.
     - 🛠️ **Detailed Breakdown of Changes**: Grouped by component/area.
     - 📁 **Files Modified & Created**: List of modified files with clickable markdown links (`file:///...`).
     - ✅ **Verification & Build Status**: Confirmation of production build results (`npm run build`).
