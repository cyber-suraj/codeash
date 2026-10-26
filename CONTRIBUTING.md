# Contributing to CodeAsh

CodeAsh is a small, security-focused project. Contributions are welcome when
they preserve the central invariant: **the language model never gets the final
word on whether a patch is safe.**

## Development setup

1. Fork and clone the repository.
2. Follow the backend and frontend quickstart in `README.md`. Runtime versions,
   environment variables, and the submission structure are listed in
   `REQUIREMENTS.md`.
3. Run the backend suite before opening a pull request:

   ```powershell
   cd backend
   .\venv\Scripts\python.exe -m unittest discover -v
   ```

4. Run the frontend checks:

   ```powershell
   cd frontend
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

## Adding a detector

A new CWE detector must include:

- a deterministic detector in `scanner.py` with a precise line number and
  isolated snippet;
- a deterministic fallback remediation in `llm.py`;
- a verifier test proving a bad patch is rejected and a good patch is accepted;
- a UI label update if the detector set changes;
- documentation of the limitation in `README.md`.

Do not add a detector that relies solely on the model's opinion.

## AI-assisted contributions

AI-assisted code is allowed. Disclose the tool and scope in the pull request,
review every line, and include tests that demonstrate behavior without the
model. Do not submit generated secrets, private source code, or credentials as
test fixtures.

## Code of conduct

Participation in this project is governed by
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Report conduct concerns privately
through the maintainer's GitHub profile or to the event organizers. Do not open
a public issue for a sensitive report.

## Security reports

Do not open a public issue for a vulnerability in CodeAsh itself. Contact the
maintainer privately through the repository profile instead.

## License

By contributing, you agree that your contribution is licensed under the MIT
License.
