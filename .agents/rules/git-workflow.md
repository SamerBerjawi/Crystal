# Git & Pull Request Workflow Rule

Always follow this Git workflow when committing and delivering changes in this repository:

1. **Never commit or push directly to `main`**:
   - Keep the `main` branch protected from direct syncs/pushes.

2. **Feature Branching**:
   - For every task, feature, refactor, or bug fix, create a descriptive branch (e.g., `feat/<feature-description>`, `fix/<issue-description>`, or `refactor/<target>`).

3. **Pre-Commit Build Verification**:
   - Run `npm run build` before committing to ensure TypeScript compilation, PWA service worker generation, and asset manifests are clean and verified.

4. **Commit & Push to Remote**:
   - Stage modified and generated files.
   - Commit with clear Conventional Commit messages (`feat(...)`, `fix(...)`, `refactor(...)`, `chore(...)`).
   - Push the branch to `origin` (`git push -u origin <branch-name>`).

5. **Provide PR Link**:
   - Provide the user with the direct GitHub Pull Request link (`https://github.com/SamerBerjawi/Crystal/pull/new/<branch-name>`) for one-click review and merging.
