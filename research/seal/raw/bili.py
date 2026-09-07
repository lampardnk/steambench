import json, time, hashlib, urllib.parse, urllib.request, os, sys

UA = ('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) '
      'Chrome/120.0.0.0 Safari/537.36')
MIXIN = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,
         14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,
         56,59,6,63,57,62,11,36,20,34,44,52]
COOKIE = ""

def get(url, referer="https://www.bilibili.com/"):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA, "Referer": referer, "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8", "Cookie": COOKIE})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

def init_cookie():
    global COOKIE
    req = urllib.request.Request("https://www.bilibili.com/", headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        cks = r.headers.get_all("Set-Cookie") or []
    COOKIE = "; ".join(c.split(";")[0] for c in cks)
    return COOKIE

def wbi_keys():
    d = get("https://api.bilibili.com/x/web-interface/nav")["data"]["wbi_img"]
    ik = d["img_url"].rsplit("/", 1)[-1].split(".")[0]
    sk = d["sub_url"].rsplit("/", 1)[-1].split(".")[0]
    o = ik + sk
    return "".join(o[i] for i in MIXIN)[:32]

def signed(path, params, mixin, referer="https://www.bilibili.com/"):
    p = dict(params); p["wts"] = int(time.time())
    q = urllib.parse.urlencode(sorted(p.items()),
        quote_via=lambda s, sa, e, er: urllib.parse.quote(str(s).translate({ord(c): None for c in "!'()*"}), safe=""))
    p["w_rid"] = hashlib.md5((q + mixin).encode()).hexdigest()
    return get(f"https://api.bilibili.com{path}?" + urllib.parse.urlencode(p), referer)
