"""F3-REC-06: after Node gateway RESTART, fresh synthetic Auth, same ephemeral PG17.
Also exercises fail-closed licensed-content revocation.
"""
import json,os,socket,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright,expect

assert sys.argv[1] in ("normal","revoked")
assert os.environ.get("GITHUB_ACTIONS")=="true"
assert os.environ.get("CANONE_CI_PG17_ONLY")=="yes"
assert os.environ.get("CANONE_SYNTHETIC_TEST_ONLY")=="1"
p=Path(os.environ["CANONE_CI_P0_TOKEN_FILE"])
tokens=json.loads(p.read_text())
assert set(tokens)=={"owner","peer","unlicensed"}
with sync_playwright() as pw:
 browser=pw.chromium.launch(headless=True,args=["--no-sandbox"])
 page=browser.new_page(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
 page.add_init_script("window.__CANONE_P0_TEST_ONLY__={getToken:async()=>"+json.dumps(tokens["owner"])+"};")
 urls=[]
 page.on("response",lambda response:urls.append(response.url.split("/api/v1/exam/")[-1]) if "/api/v1/exam/" in response.url else None)
 page.goto("http://127.0.0.1:4177/jornada-servidor.html",wait_until="networkidle")
 page.get_by_role("button",name="Carregar formulário de teste").click()
 if sys.argv[1]=="revoked":
  expect(page.get_by_role("alert")).to_contain_text("recusada",timeout=8000)
  assert "Iniciar tentativa no gateway" not in page.locator("main").inner_text()
  assert urls==["catalog","questions"],urls
  assert "Gabarito retornado pelo servidor:" not in page.locator("main").inner_text()
  print("PASS F3-REC06: expired synthetic content-license denied entire form, no question disclosure")
 else:
  expect(page.get_by_role("button",name="Iniciar tentativa no gateway")).to_be_visible()
  page.get_by_role("button",name="Consultar histórico").click()
  expect(page.get_by_role("button",name="Consultar tentativa")).to_be_visible()
  page.get_by_role("button",name="Consultar tentativa").click()
  expect(page.get_by_role("button",name="Consultar gabarito posterior")).to_be_visible()
  page.get_by_role("button",name="Consultar gabarito posterior").click()
  expect(page.get_by_role("heading",name="Correção posterior · 2/2")).to_be_visible()
  assert all(x in urls for x in ("catalog","questions","history","resume","reveal")),urls
  assert page.evaluate("localStorage.length+sessionStorage.length")==0
  assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
  print("PASS F3-REC06: NEW gateway process + fresh HMAC token -> same persisted PG17 attempt/mobile")
 browser.close()
