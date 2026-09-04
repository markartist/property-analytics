import importlib.util
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "run_resi_edge_preapply_gates.py"


def load_module():
    spec = importlib.util.spec_from_file_location("run_resi_edge_preapply_gates", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_parse_last_json_object_reads_final_payload():
    module = load_module()
    payload = module.parse_last_json_object('noise\n{"pass": false}\n{"pass": true, "gate": "ok"}\n')
    assert payload == {"pass": True, "gate": "ok"}


def test_domain_matches_ignores_www_prefix():
    module = load_module()
    assert module.domain_matches("www.balmoralvillageapts.com", "balmoralvillageapts.com")
    assert module.domain_matches("BalmoralVillageApts.com", "balmoralvillageapts.com")


def test_gate_summary_accepts_successful_non_json_command():
    module = load_module()
    record = {
        "pass": True,
        "returncode": 0,
        "duration_seconds": 0.01,
        "stdout_tail": "Resi Edge gate coverage passed",
        "stderr_tail": "",
        "parsed_json": None,
    }
    summary = module.gate_summary("gate_coverage", record)
    assert summary["pass"] is True


def test_gate_summary_blocks_parsed_failed_payload():
    module = load_module()
    record = {
        "pass": True,
        "returncode": 0,
        "duration_seconds": 0.01,
        "stdout_tail": '{"pass": false}',
        "stderr_tail": "",
        "parsed_json": {"pass": False, "reason": "stale proof"},
    }
    summary = module.gate_summary("desktop_native_visual_gate", record)
    assert summary["pass"] is False
