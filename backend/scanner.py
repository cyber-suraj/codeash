import ast
import re
import textwrap
from typing import Any, Dict, List

AWS_KEY_REGEX = re.compile(r"AKIA[0-9A-Z]{16}")
SECRET_VAR_NAMES = (
    "password",
    "secret",
    "token",
    "api_key",
    "aws_secret",
    "passwd",
    "private_key",
)


class VulnerabilityScanner(ast.NodeVisitor):
    """Deterministic AST scanner for high-signal Python vulnerabilities."""

    def __init__(self, source_code: str):
        self.source_code = source_code
        self.lines = source_code.splitlines()
        self.findings: List[Dict[str, Any]] = []
        self._recorded_keys = set()

    def _get_line_snippet(self, node: ast.AST) -> str:
        lineno = getattr(node, "lineno", 1)
        end_lineno = getattr(node, "end_lineno", lineno)
        if 1 <= lineno <= len(self.lines):
            snippet_lines = self.lines[lineno - 1 : end_lineno]
            return textwrap.dedent("\n".join(snippet_lines)).strip()
        return ""

    def _add_finding(self, cwe: str, message: str, lineno: int, original_code: str):
        key = (cwe, lineno)
        if key not in self._recorded_keys:
            self._recorded_keys.add(key)
            self.findings.append(
                {
                    "cwe": cwe,
                    "message": message,
                    "line": lineno,
                    "original_code": original_code,
                }
            )

    def visit_Call(self, node: ast.Call):
        # 1. Detect CWE-78: OS Command Injection via subprocess(..., shell=True) or os.system(...)
        is_subprocess_call = False
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            if node.func.value.id == "subprocess" and node.func.attr in (
                "run",
                "Popen",
                "call",
                "check_output",
                "check_call",
            ):
                is_subprocess_call = True
            elif node.func.value.id == "os" and node.func.attr in ("system", "popen"):
                self._add_finding(
                    cwe="CWE-78",
                    message="Command injection risk via direct OS shell execution",
                    lineno=node.lineno,
                    original_code=self._get_line_snippet(node),
                )
        elif isinstance(node.func, ast.Name) and node.func.id in (
            "run",
            "Popen",
            "call",
            "check_output",
            "check_call",
        ):
            is_subprocess_call = True

        if is_subprocess_call:
            for kw in node.keywords:
                if (
                    kw.arg == "shell"
                    and isinstance(kw.value, ast.Constant)
                    and kw.value.value is True
                ):
                    self._add_finding(
                        cwe="CWE-78",
                        message="Command injection via subprocess with shell=True",
                        lineno=node.lineno,
                        original_code=self._get_line_snippet(node),
                    )

        # 2. Detect CWE-502: Unsafe Deserialization via pickle.loads / pickle.load / _pickle.loads
        is_pickle_call = False
        if isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
            if node.func.value.id in ("pickle", "_pickle", "cPickle") and node.func.attr in (
                "loads",
                "load",
            ):
                is_pickle_call = True
        elif isinstance(node.func, ast.Name) and node.func.id in ("loads", "load"):
            snippet = self._get_line_snippet(node)
            if "pickle" in snippet:
                is_pickle_call = True

        if is_pickle_call:
            self._add_finding(
                cwe="CWE-502",
                message="Unsafe deserialization via pickle.loads allows arbitrary code execution",
                lineno=node.lineno,
                original_code=self._get_line_snippet(node),
            )

        self.generic_visit(node)

    def _check_assignment(self, targets: List[ast.expr], value: ast.expr, node: ast.AST):
        if not (isinstance(value, ast.Constant) and isinstance(value.value, str)):
            return

        secret_val = value.value.strip()
        if not secret_val:
            return

        for target in targets:
            target_names = []
            if isinstance(target, ast.Name):
                target_names.append(target.id)
            elif isinstance(target, ast.Attribute):
                target_names.append(target.attr)

            for var_name in target_names:
                lower_name = var_name.lower()
                matches_aws = bool(AWS_KEY_REGEX.search(secret_val))
                matches_var = any(k in lower_name for k in SECRET_VAR_NAMES)

                if matches_aws or matches_var:
                    self._add_finding(
                        cwe="CWE-798",
                        message=f"Hardcoded cryptographic secret or credential in '{var_name}'",
                        lineno=node.lineno,
                        original_code=self._get_line_snippet(node),
                    )

    def visit_Assign(self, node: ast.Assign):
        self._check_assignment(node.targets, node.value, node)
        self.generic_visit(node)

    def visit_AnnAssign(self, node: ast.AnnAssign):
        if node.value is not None:
            self._check_assignment([node.target], node.value, node)
        self.generic_visit(node)


def scan_code(source_code: str) -> List[Dict[str, Any]]:
    """
    Deterministically parses Python source code into an Abstract Syntax Tree (AST)
    and scans for CWE-78, CWE-502, and CWE-798. Also performs a regex sweep for
    raw AWS access keys on any lines not already flagged.
    """
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return []

    scanner = VulnerabilityScanner(source_code)
    scanner.visit(tree)

    # Supplemental line-level regex check for AWS keys (AKIA...)
    lines = source_code.splitlines()
    for idx, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if AWS_KEY_REGEX.search(stripped):
            scanner._add_finding(
                cwe="CWE-798",
                message="Hardcoded AWS Access Key ID detected (AKIA...)",
                lineno=idx,
                original_code=stripped,
            )

    return sorted(scanner.findings, key=lambda finding: finding["line"])
