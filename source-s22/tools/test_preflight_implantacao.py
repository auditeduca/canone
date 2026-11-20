"""Regressão mínima dos critérios de continuidade, sem serviços externos."""
import unittest
from preflight_implantacao import evaluate

class PreflightContinuityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.out=evaluate()
        cls.byid={c['id']:c for c in cls.out['checks']}

    def test_catalogo_26_preservado(self):
        self.assertTrue(self.byid['CATALOGO_26']['passed'])
    def test_migrations_30_preservadas(self):
        self.assertTrue(self.byid['MIGRACOES_30']['passed'])
    def test_cadeia_canonica_preservada(self):
        self.assertTrue(self.byid['PROVENIENCIA_CANONICA']['passed'])
    def test_no_go_sem_homologacao(self):
        self.assertEqual(self.out['release_gate'],'HOLD_HUMAN')
        self.assertIn('CORPUS_HOMOLOGADO',self.out['blocking_failures'])
    def test_segredo_administrativo_removido_do_frontend(self):
        self.assertTrue(self.byid['SEGREDO_FRONTEND']['passed'])
    def test_fonte_visual_ausente_nao_ignoravel(self):
        self.assertIn('FONTES_DS',self.out['blocking_failures'])
        self.assertTrue(self.byid['NAO_DISTRIBUIR_FONTES']['passed'])
    def test_sessao_da_previa_nao_persiste(self):
        self.assertTrue(self.byid['SESSAO_PREVIEW_NAO_PERSISTE']['passed'])
        self.assertIn('SESSAO_SEGURA',self.out['blocking_failures'])
    def test_previa_http_confirmada_mas_nao_go(self):
        self.assertTrue(self.byid['VERCEL_PREVIEW']['passed'])
        self.assertIn('CORPUS_HOMOLOGADO',self.out['blocking_failures'])

if __name__=='__main__':unittest.main()
