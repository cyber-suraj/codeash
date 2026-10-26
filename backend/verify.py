import ast
import textwrap

from scanner import scan_code


def _candidate_forms(code: str):
    """Yield parseable forms for snippets that may begin with a return/expression."""
    yield code
    yield "def __codeash_snippet__():\n" + textwrap.indent(code, "    ")


def _parse_and_scan(code: str):
    """Return (parsed_tree, findings) for the first syntactically valid form."""
    for candidate in _candidate_forms(code):
        try:
            tree = ast.parse(candidate)
        except SyntaxError:
            continue
        return tree, scan_code(candidate)
    return None, None


def verify_patch(original_code: str, patched_code: str, cwe: str) -> bool:
    """
    The Kill Switch ("LLM proposes, Python disposes"):
    1. Dedents and parses `patched_code` using `ast.parse()` to prove syntactic validity.
    2. Re-runs `scan_code()` on the patched code to prove the specific `cwe` is eliminated.
    3. Ensures the patch actually modified the vulnerable code.
    """
    if not patched_code or not patched_code.strip():
        return False

    normalized_patch = textwrap.dedent(patched_code).strip()
    normalized_original = textwrap.dedent(original_code).strip()

    if normalized_patch == normalized_original:
        return False

    # Step 1 + 2: parse into an AST and re-scan the validated candidate.
    tree, remaining_vulnerabilities = _parse_and_scan(normalized_patch)
    if tree is None or remaining_vulnerabilities is None:
        return False

    for vuln in remaining_vulnerabilities:
        if vuln.get("cwe") == cwe:
            return False

    return True
