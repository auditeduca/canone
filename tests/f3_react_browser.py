"""F3-REC-03 real Chromium against historical React components and HTTP stub.
Explicit LOCAL TEST DATA only. No Supabase/JWT managed or PostgreSQL in this run.
"""
from pathlib import Path
import json
import socket
import subprocess
import time
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/"source-s22/app"
PORT=4176
URL=f"http://127.0.0.1:{PORT}/jornada-servidor.html"
FORM="00000000-0000-4000-8000-000000000004"
ATTEMPT="33333333-3333-4333-8333-333333333333"
FORM_DATA={"id":FORM,"questions":[
    {"ordinal":1,"stem":"Pergunta fictícia número um para integração?",
     "options":[{"code":"A","text":"Alternativa A"},{"code":"B","text":"Alternativa B"}]},
    {"ordinal":2,"stem":"Pergunta fictícia número dois para integração?",
     "options":[{"code":"A","text":"Alternativa A"},{"code":"B","text":"Alternativa B"}]}
]}
RUNTIME=f"""window.__CANONE_P0_TEST_ONLY__={{
  getToken:async()=> 'a.b.c',
  getForm:async()=>({json.dumps(FORM_DATA,ensure_ascii=False)})
}};"""

def wait_server(process):
    for _ in range(80):
        if process.poll() is not None:raise RuntimeError("Vite exited before readiness")
        try:
            with socket.create_connection(("127.0.0.1",PORT),timeout=.15):return
        except OSError:time.sleep(.15)
    raise RuntimeError("Vite did not start")

def stub_api(page,denied=False):
    state={"calls":[],"answers":{},"finished":False,"revealed":False,"reviews":[]}
    def handler(route):
        req=route.request
        path=req.url.split("/api/v1/exam/")[-1].split("?")[0]
        body=json.loads(req.post_data or '{}')
        assert req.method=="POST" and req.headers.get("authorization")=="Bearer a.b.c"
        assert "userId" not in body and "correct_option" not in json.dumps(body)
        state["calls"].append(path)
        code=200
        if denied and path=="start":code,payload=403,{"ok":False,"error":"FEATURE_NOT_AUTHORIZED"}
        elif path=="start":payload={"ok":True,"data":{"id":ATTEMPT}}
        elif path=="answer":
            assert not state["finished"]
            state["answers"][body["ordinal"]]=body["option"]
            payload={"ok":True,"data":{"accepted":True}}
        elif path=="finish":
            assert len(state["answers"])==2
            state["finished"]=True;payload={"ok":True,"data":{"answered_count":2}}
        elif path=="reveal":
            if not state["finished"]:
                code,payload=409,{"ok":False,"error":"ACTION_NOT_ALLOWED"}
            else:
                state["revealed"]=True
                payload={"ok":True,"data":{"rows":[{"ordinal":1,"correct_option":"A"},
                                                {"ordinal":2,"correct_option":"B"}]}}
        elif path=="review":
            assert state["revealed"]
            state["reviews"].append(body["ordinal"])
            payload={"ok":True,"data":{"id":f"srs-{body['ordinal']}"}}
        else:code,payload=404,{"ok":False,"error":"NOT_FOUND"}
        route.fulfill(status=code,content_type="application/json",body=json.dumps(payload))
    page.route("**/api/v1/exam/**",handler)
    return state

proc=subprocess.Popen([str(APP/"node_modules/.bin/vite"),"--host","127.0.0.1",
    "--port",str(PORT),"--strictPort"],cwd=APP,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
    wait_server(proc)
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True,args=["--no-sandbox"])
        page=browser.new_page(viewport={"width":1440,"height":900})
        page.add_init_script(RUNTIME)
        state=stub_api(page)
        page.goto(URL,wait_until="networkidle")
        expect(page.get_by_role("heading",name="Simulado com autoridade no servidor")).to_be_visible()
        expect(page.get_by_role("button",name="Carregar formulário de teste")).to_be_visible()
        assert "gabarito" not in page.locator("main").inner_text().lower().replace("sem gabarito","").replace("o gabarito","")
        page.get_by_role("button",name="Carregar formulário de teste").click()
        expect(page.get_by_role("button",name="Iniciar tentativa no gateway")).to_be_visible()
        page.get_by_role("button",name="Iniciar tentativa no gateway").click()
        expect(page.get_by_text("Pergunta fictícia número um")).to_be_visible()
        assert "reveal" not in state["calls"]
        page.get_by_role("button",name="Registrar resposta").is_disabled()
        page.get_by_role("button",name="A Alternativa A").click()
        page.get_by_role("button",name="Registrar resposta").click()
        expect(page.get_by_text("Pergunta fictícia número dois")).to_be_visible()
        page.get_by_role("button",name="B Alternativa B").click()
        page.get_by_role("button",name="Registrar resposta").click()
        expect(page.get_by_role("button",name="Concluir tentativa")).to_be_visible()
        assert state["calls"]==["start","answer","answer"]
        page.get_by_role("button",name="Concluir tentativa").click()
        expect(page.get_by_role("button",name="Consultar gabarito posterior")).to_be_visible()
        assert "reveal" not in state["calls"]
        page.get_by_role("button",name="Consultar gabarito posterior").click()
        expect(page.get_by_role("heading",name="Correção posterior · 2/2")).to_be_visible()
        page.get_by_role("button",name="Registrar revisão SRS").first.click()
        expect(page.get_by_role("button",name="Revisão registrada")).to_be_visible()
        assert state["calls"]==["start","answer","answer","finish","reveal","review"]
        assert len(state["reviews"])==1
        assert page.evaluate("localStorage.length+sessionStorage.length")==0
        page.reload(wait_until="networkidle")
        expect(page.get_by_role("button",name="Carregar formulário de teste")).to_be_visible()
        # Refuse an invalid subscription without changing UI to active.
        denied=browser.new_page(viewport={"width":1200,"height":800})
        denied.add_init_script(RUNTIME)
        refused=stub_api(denied,denied=True)
        denied.goto(URL,wait_until="networkidle")
        denied.get_by_role("button",name="Carregar formulário de teste").click()
        denied.get_by_role("button",name="Iniciar tentativa no gateway").click()
        expect(denied.get_by_role("alert")).to_contain_text("autorização")
        assert refused["calls"]==["start"]
        assert not denied.get_by_role("button",name="Registrar resposta").count()
        mobile=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
        mobile.add_init_script(RUNTIME)
        stub_api(mobile)
        mobile.goto(URL,wait_until="networkidle")
        mobile.get_by_role("button",name="Carregar formulário de teste").click()
        mobile.get_by_role("button",name="Iniciar tentativa no gateway").click()
        expect(mobile.get_by_text("Pergunta fictícia número um")).to_be_visible()
        assert mobile.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        locked=browser.new_page()
        locked.goto(URL,wait_until="networkidle")
        expect(locked.get_by_role("heading",name="Integração desabilitada")).to_be_visible()
        keyboard=browser.new_page()
        keyboard.goto(URL,wait_until="networkidle")
        keyboard.keyboard.press("Tab")
        assert keyboard.evaluate("document.activeElement.classList.contains('skip-link')")
        browser.close()
        print("PASS F3-REC03 Chromium React S22: POST flow, no early reveal, denied 403, mobile, keyboard, no token storage")
finally:
    proc.terminate()
    try:proc.wait(timeout=8)
    except subprocess.TimeoutExpired:proc.kill()
