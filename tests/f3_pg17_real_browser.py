"""Chromium React historical UI -> real gateway -> ephemeral PG17 with synthetic Auth.
Never run outside guarded GitHub Actions. Form is injected synthetic UI data only.
"""
import json,os,socket,subprocess,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
APP=ROOT/"source-s22/app"
FORM="00000000-0000-4000-8000-000000000004"
DATA={"id":FORM,"questions":[
 {"ordinal":1,"stem":"Questão fictícia contábil um para teste?",
  "options":[{"code":"A","text":"Opção A sintética"},{"code":"B","text":"Opção B sintética"}]},
 {"ordinal":2,"stem":"Questão fictícia contábil dois para teste?",
  "options":[{"code":"A","text":"Opção A sintética"},{"code":"B","text":"Opção B sintética"}]}
]}
assert os.getenv("GITHUB_ACTIONS")=="true" and os.getenv("CANONE_CI_PG17_ONLY")=="yes"
assert os.getenv("CANONE_SYNTHETIC_TEST_ONLY")=="1"
p=Path(os.environ["CANONE_CI_P0_TOKEN_FILE"])
assert p.parent==Path("/tmp") and p.name.startswith("canone-p0-token-")
jwt=json.loads(p.read_text())
assert set(jwt)=={"owner","peer","unlicensed"}
def port_ok(port):
 for _ in range(75):
  try:
   with socket.create_connection(("127.0.0.1",port),timeout=.15):return
  except OSError:time.sleep(.15)
 raise RuntimeError("No local service on requested port")
port_ok(8788)
proc=subprocess.Popen([str(APP/"node_modules/.bin/vite"),"--config","vite.p0.config.ts",
 "--host","127.0.0.1","--port","4177","--strictPort"],
 cwd=APP,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
try:
 port_ok(4177)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
  page=browser.new_page(viewport={"width":1440,"height":900})
  init="window.__CANONE_P0_TEST_ONLY__={getToken:async()=>"+json.dumps(jwt["owner"])+"};"
  page.add_init_script(init)
  observed=[]
  page.on("response",lambda r:observed.append(r.url.split("/api/v1/exam/")[-1]) if "/api/v1/exam/" in r.url else None)
  page.goto("http://127.0.0.1:4177/jornada-servidor.html",wait_until="networkidle")
  page.get_by_role("button",name="Carregar formulário de teste").click()
  page.get_by_role("button",name="Iniciar tentativa no gateway").click()
  expect(page.get_by_text("Questão fictícia contábil um")).to_be_visible()
  assert observed==["catalog","questions","start"],observed
  # Additional test attempt allows IDOR and early-key negative without exposing main UI ID.
  negatives=page.evaluate("""async({peer,unlicensed})=>{
    const post=async (route,token,body)=>{
      const r=await fetch('/api/v1/exam/'+route,{method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+token},
        body:JSON.stringify(body)});
      return {status:r.status,body:await r.json()};
    };
    const owner=await window.__CANONE_P0_TEST_ONLY__.getToken();
    const start=await post('start',owner,{formId:'00000000-0000-4000-8000-000000000004'});
    const attempt=start.body.data.id;
    return {
      start,early:await post('reveal',owner,{attemptId:attempt}),
      other:await post('answer',peer,{attemptId:attempt,ordinal:1,option:'A'}),
      otherResume:await post('resume',peer,{attemptId:attempt}),
      missingPlanRead:await post('history',unlicensed,{}),
      missingPlanQuestions:await post('questions',unlicensed,{formId:'00000000-0000-4000-8000-000000000004'}),
      denied:await post('start',unlicensed,{formId:'00000000-0000-4000-8000-000000000004'})
    };
  }""",{"peer":jwt["peer"],"unlicensed":jwt["unlicensed"]})
  assert negatives["start"]["status"]==200,negatives
  assert negatives["early"]["status"]!=200,negatives
  assert "correct_option" not in json.dumps(negatives["early"])
  assert negatives["other"]["status"]==403,negatives
  assert negatives["otherResume"]["status"]==404,negatives
  assert negatives["missingPlanRead"]["status"]==403,negatives
  assert negatives["missingPlanQuestions"]["status"]==403,negatives
  assert negatives["denied"]["status"]==403,negatives
  page.get_by_role("button",name="A Opção A sintética").click()
  page.get_by_role("button",name="Registrar resposta").click()
  expect(page.get_by_text("Questão fictícia contábil dois")).to_be_visible()
  # Full browser reload, no localStorage or stored token/attempt ID. PG17 must restore response.
  page.reload(wait_until="networkidle")
  page.get_by_role("button",name="Carregar formulário de teste").click()
  page.get_by_role("button",name="Consultar histórico").click()
  progress_row=page.get_by_text("1/2 respostas").locator("..").locator("..")
  resume_button=progress_row.get_by_role("button",name="Retomar tentativa")
  expect(resume_button).to_be_visible()
  resume_button.click()
  expect(page.get_by_text("Questão fictícia contábil dois")).to_be_visible()
  assert "Gabarito retornado pelo servidor:" not in page.locator("main").inner_text()
  page.get_by_role("button",name="B Opção B sintética").click()
  page.get_by_role("button",name="Registrar resposta").click()
  expect(page.get_by_role("button",name="Concluir tentativa")).to_be_visible()
  page.get_by_role("button",name="Concluir tentativa").click()
  expect(page.get_by_role("button",name="Consultar gabarito posterior")).to_be_visible()
  page.get_by_role("button",name="Consultar gabarito posterior").click()
  expect(page.get_by_role("heading",name="Correção posterior · 2/2")).to_be_visible()
  page.get_by_role("button",name="Registrar revisão SRS").first.click()
  expect(page.get_by_role("button",name="Revisão registrada")).to_be_visible()
  assert page.evaluate("localStorage.length+sessionStorage.length")==0
  assert all(x in observed for x in ("catalog","questions","history","resume","start","answer","finish","reveal","review")),observed
  browser.close()
  print("PASS F3-REC05: reload->history->owner resume->answer->finish->reveal->SRS real PG17; no early key")
finally:
 proc.terminate()
 try:proc.wait(timeout=8)
 except subprocess.TimeoutExpired:proc.kill()
