"""NS04 real Chromium desktop/mobile E2E. Local synthetic DOM only; never real Auth/PG."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(ROOT)))
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()
URL=f'http://127.0.0.1:{server.server_port}/frontend/student/index.html?demo=1'
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=['--no-sandbox'])
        desktop=browser.new_page(viewport={'width':1440,'height':900})
        desktop.goto(URL,wait_until='networkidle')
        assert desktop.title().startswith('Cânone')
        assert desktop.locator('#metric-answered').inner_text()=='0/2'
        assert desktop.locator('#review-content').inner_text().find('Conclua')>=0
        desktop.get_by_role('button',name='Iniciar simulado').click()
        assert desktop.locator('#exam').is_visible()
        assert not desktop.locator('#reveal-button').is_visible()
        desktop.locator('input[name="choice"][value="B"]').check()
        desktop.get_by_role('button',name='Salvar resposta').click()
        expect(desktop.locator('#exam-count')).to_have_text('1 de 2')
        desktop.locator('input[name="choice"][value="C"]').check()
        desktop.get_by_role('button',name='Salvar resposta').click()
        expect(desktop.locator('#exam-count')).to_have_text('2 de 2')
        assert not desktop.locator('#reveal-button').is_visible()
        desktop.get_by_role('button',name='Concluir tentativa').click()
        expect(desktop.get_by_role('button',name='Ver correção')).to_be_visible()
        assert desktop.locator('#metric-score').inner_text()=='—'
        desktop.get_by_role('button',name='Ver correção').click()
        expect(desktop.locator('#metric-score')).to_have_text('2/2')
        desktop.locator('[data-nav="review"]').click()
        assert desktop.locator('.review-card').count()==2
        desktop.locator('.review-card').first.get_by_role('button',name='Registrar revisão SRS').click()
        expect(desktop.locator('#metric-reviews')).to_have_text('1')
        assert desktop.locator('.review-card').first.get_by_role('button',name='Revisão registrada').is_disabled()
        # No token in address/local storage; 100% synthetic local fixture.
        assert desktop.evaluate("Object.keys(localStorage).length")==0
        mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        mobile.goto(URL,wait_until='networkidle')
        assert mobile.locator('.nav').is_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        mobile.get_by_role('button',name='Iniciar simulado').click()
        assert mobile.locator('#exam').is_visible()
        assert mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        keyboard=browser.new_page(viewport={'width':1280,'height':800})
        keyboard.goto(URL,wait_until='networkidle')
        keyboard.keyboard.press('Tab')
        assert keyboard.evaluate('document.activeElement.classList.contains("skip")')
        browser.close()
        print('PASS NS04 Chromium: desktop journey, no early key, mobile 390px, keyboard skip link')
finally:
    server.shutdown()
    server.server_close()
