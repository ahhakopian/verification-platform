from pathlib import Path
import re
import unittest
import tomllib
import tempfile
ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / 'frontends/browser-verification'
class ContractTests(unittest.TestCase):
    def test_frontend_links_resolve(self):
        text = (FRONTEND / 'SKILL.md').read_text()
        for target in re.findall(r'\]\(([^)]+)\)', text):
            self.assertTrue((FRONTEND / target).is_file(), target)
        self.assertIn('exactly one browser worker at a time', text)
        self.assertIn('Only the supported WSL → Windows', text)
    def test_no_pointer_or_private_routes(self):
        source = (ROOT / 'runtime/host/wsl-windows/native-ui.ps1').read_text()
        for forbidden in ('DllImport', 'SetCursorPos', 'mouse_event', 'FromPoint', 'LegacyIAccessible'):
            self.assertNotIn(forbidden, source)
    def test_one_canonical_helper_set(self):
        for name in ('browser-session.py', 'browser-runtime.ps1', 'native-ui.ps1', 'extension-action.cjs'):
            found = [p for p in ROOT.rglob(name) if 'dist' not in p.parts and 'node_modules' not in p.parts]
            self.assertEqual(len(found), 1, name)
    def test_frontend_agent_templates_relocate_and_preserve_model_routing(self):
        with tempfile.TemporaryDirectory() as directory:
            skill = str(Path(directory) / 'distribution/dist/frontends/browser-verification/SKILL.md')
            for role in ('luna', 'sol'):
                text = (FRONTEND / f'agents/browser-{role}.toml.template').read_text()
                self.assertNotIn('/home/art/', text)
                config = tomllib.loads(text.replace('@BROWSER_VERIFICATION_SKILL@', skill))
                self.assertEqual(config['name'], f'browser_{role}')
                self.assertEqual(config['model_reasoning_effort'], 'medium')
                self.assertEqual(config['skills']['config'][0]['path'], skill)
                self.assertFalse(config['skills']['config'][0]['enabled'])
                self.assertIn('Do not redelegate', config['developer_instructions']) if role == 'luna' else self.assertIn('without further escalation or redelegation', config['developer_instructions'])
if __name__ == '__main__':
    unittest.main()
