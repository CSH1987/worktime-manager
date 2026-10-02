"use client";

// 내 캘린더 연결 — 구글 캘린더에 '팀 근태' 캘린더를 만들어 모두의 일정을 받아 본다.
// 연결한 브라우저는 해제 비밀키를 localStorage 에 보관한다(그 브라우저만 해제 가능).
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Conn {
  id: string;
  provider: "google";
  label: string;
  ok: boolean;
  lastOkAt: string | null;
  lastError: string | null;
}

const OWNED_KEY = "wt-calendar-owned";

function readOwned(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(OWNED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}
function writeOwned(v: Record<string, string>) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(v));
  } catch {}
}

const PROVIDER = { google: "구글" } as const;

/** 구글에서 돌아올 때 주소에 붙는 오류 코드 → 정해진 문구만 보여 준다 */
const CALLBACK_ERRORS: Record<string, string> = {
  cancelled: "구글 연결을 취소했습니다.",
  expired: "연결 시간이 지났습니다. 다시 시도해 주세요.",
  scope: "캘린더 권한 체크박스를 체크하지 않았습니다. 다시 연결하면서 꼭 체크해 주세요.",
  capacity: "연결 수 상한에 닿았습니다. 관리자에게 알려 주세요.",
  failed: "연결에 실패했습니다. 잠시 뒤 다시 시도해 주세요.",
};

export default function CalendarConnect() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState({ google: false });
  const [list, setList] = useState<Conn[]>([]);
  const [owned, setOwned] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/calendar/list", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
    if (r) {
      setEnabled(r.enabled);
      setList(r.connections);
    }
  }, []);

  /** 처음 연결한 뒤 캘린더가 다 찰 때까지 채우기 */
  const fill = useCallback(
    async (id: string, secret: string) => {
      setBusy(true);
      setMsg("캘린더에 일정을 채우는 중…");
      for (let i = 0; i < 15; i++) {
        const r = await fetch("/api/calendar/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, secret }),
        })
          .then((x) => x.json())
          .catch(() => ({ error: "네트워크 오류" }));
        if (r.error) {
          setMsg(`채우기 실패: ${r.error}`);
          break;
        }
        if (r.removed) {
          setMsg("캘린더를 찾지 못해 연결이 해제됐습니다. 다시 연결해 주세요.");
          break;
        }
        if (r.held) {
          setMsg("일정은 들어갔지만, 앞으로의 일정 일부 삭제를 안전을 위해 보류했습니다. 관리자에게 알려 주세요.");
          break;
        }
        if (r.failed > 0 && r.remaining === 0) {
          setMsg(`일정 ${r.failed}건을 보내지 못했습니다 — 10분마다 자동으로 다시 시도합니다. 나머지는 캘린더에 들어갔습니다.`);
          break;
        }
        if (r.done) {
          setMsg("연결 완료 — 이제 내 캘린더의 '팀 근태'에서 모두의 일정을 볼 수 있습니다. 앞으로 바뀌는 내용은 10분마다 자동 반영됩니다.");
          break;
        }
        setMsg(`캘린더에 일정을 채우는 중… (남은 ${r.remaining}건)`);
      }
      setBusy(false);
      load();
    },
    [load],
  );

  const openModal = useCallback(() => {
    setOpen(true);
    load();
  }, [load]);

  // 구글 동의 화면에서 돌아온 경우 (#cal=<id>.<secret> 또는 #calerr=...)
  useEffect(() => {
    const h = window.location.hash;
    // 화면 상태는 다음 틱에 바꾼다(효과 안에서 곧바로 setState 하지 않음)
    const t = setTimeout(() => {
      setOwned(readOwned());
      if (!h.startsWith("#cal")) return;
      history.replaceState(null, "", window.location.pathname);
      openModal();
      const ok = /^#cal=([^.]+)\.(.+)$/.exec(h);
      if (ok) {
        const next = { ...readOwned(), [ok[1]]: ok[2] };
        writeOwned(next);
        setOwned(next);
        fill(ok[1], ok[2]);
      } else {
        setMsg(CALLBACK_ERRORS[h.replace(/^#calerr=/, "")] ?? CALLBACK_ERRORS.failed);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [fill, openModal]);

  async function connectGoogle() {
    setBusy(true);
    const r = await fetch("/api/calendar/google/start", { method: "POST" }).then((x) => x.json()).catch(() => null);
    if (r?.url) window.location.href = r.url;
    else {
      setMsg(r?.error ?? "구글 연결을 시작하지 못했습니다.");
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    const secret = owned[id];
    if (!secret) return;
    setBusy(true);
    const res = await fetch("/api/calendar/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, secret }),
    }).catch(() => null);
    // 서버가 해제를 확인했을 때만 이 브라우저의 비밀키를 지운다(실패하면 다시 시도할 수 있게)
    if (!res?.ok && res?.status !== 403) {
      setMsg("해제하지 못했습니다. 잠시 뒤 다시 눌러 주세요.");
      setBusy(false);
      return;
    }
    const next = { ...owned };
    delete next[id];
    writeOwned(next);
    setOwned(next);
    setMsg("연결을 해제했습니다. 내 캘린더의 '팀 근태' 캘린더는 직접 지우면 됩니다.");
    setBusy(false);
    load();
  }

  const btn = "rounded-lg px-3 py-2 text-sm font-semibold";

  return (
    <>
      <button
        onClick={openModal}
        className="ml-1 rounded-full bg-linear-to-r from-emerald-500 to-sky-500 px-3 py-1.5 text-sm font-semibold text-white shadow-sm ring-2 ring-emerald-200 transition hover:brightness-110 sm:px-3.5"
      >
        📅 캘린더 연동
      </button>
      {/* 헤더의 backdrop-blur 가 fixed 위치의 기준을 헤더로 바꾸므로 body 로 띄운다 */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-base font-bold text-slate-900">내 캘린더에서 팀 일정 보기</h2>
            <p className="mt-1 text-sm text-slate-500">
              연결하면 내 계정에 &lsquo;팀 근태&rsquo; 캘린더가 생기고, 앱 달력의 부재·잔업·패밀리데이가 자동으로 들어갑니다.
              앱에서 바꾼 내용은 <b>10분마다 자동으로</b> 캘린더에 반영됩니다(내 컴퓨터·휴대폰이 꺼져 있어도 됩니다).
              사이트에 문제가 생겨도 이 캘린더의 일정(이력)은 내 계정에 그대로 남습니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={busy || !enabled.google} onClick={connectGoogle} className={`${btn} bg-[#1428A0] text-white disabled:opacity-40`}>
                구글 캘린더 연결
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              구글 동의 화면에서 <b>캘린더 권한 체크박스</b>를 꼭 체크하세요. 아이폰은 설정 → 캘린더 → 계정 → 계정 추가 → Google 로 같은 구글 계정을 넣으면 아이폰 캘린더에도 보입니다.
            </p>
            {!enabled.google && (
              <p className="mt-2 text-xs text-slate-400">관리자 설정이 끝나면 연결할 수 있습니다.</p>
            )}


            {msg && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-[#1428A0]">{msg}</p>}

            <h3 className="mt-5 text-sm font-semibold text-slate-700">연결된 캘린더 ({list.length})</h3>
            <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
              {list.length === 0 && <li className="text-sm text-slate-400">아직 없습니다.</li>}
              {list.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-slate-800">
                      {PROVIDER[c.provider]} · {c.label}
                    </div>
                    <div className={`text-xs ${c.ok ? "text-emerald-600" : "text-rose-600"}`}>
                      {c.ok ? (c.lastOkAt ? `정상 · ${new Date(c.lastOkAt).toLocaleString("ko-KR")}` : "대기 중") : c.lastError}
                    </div>
                  </div>
                  {owned[c.id] && (
                    <button disabled={busy} onClick={() => disconnect(c.id)} className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50">
                      해제
                    </button>
                  )}
                </li>
              ))}
            </ul>

            <details className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-semibold text-slate-700">연동 해제 방법과 해제하면 어떻게 되나요?</summary>
              <div className="mt-2 space-y-1.5">
                <p>
                  <b>해제 방법</b>{" "}① 연결했던 브라우저에서 위 목록의 <b>해제</b> 버튼을 누릅니다. ② 다른 기기라면 구글 계정 →
                  보안 → 타사 앱 및 서비스 → &lsquo;팀 근태 캘린더&rsquo; → 액세스 삭제. 이 목록에는 &lsquo;다시 연결 필요&rsquo;로 보이다가 30일 뒤 자동 정리됩니다.
                </p>
                <p>
                  <b>해제하면</b>{" "}앞으로 바뀌는 내용이 더 이상 들어오지 않습니다. 이미 받은 &lsquo;팀 근태&rsquo; 캘린더와 일정(이력)은
                  내 구글 캘린더에 <b>그대로 남습니다</b>. 앱에서 지난 기록이 지워져도 캘린더의 지난 일정은 지워지지 않습니다.
                </p>
                <p>
                  <b>완전히 지우려면</b>{" "}구글 캘린더 → 설정 → &lsquo;팀 근태&rsquo; → 캘린더 삭제. (지우면 되살릴 수 없습니다)
                </p>
                <p>
                  <b>다시 연결하면</b>{" "}남아 있던 &lsquo;팀 근태&rsquo; 캘린더를 이어서 씁니다(두 개로 늘지 않음).
                </p>
              </div>
            </details>

            <div className="mt-4 flex justify-end">
              <button disabled={busy} onClick={() => setOpen(false)} className={`${btn} text-slate-500 hover:bg-slate-100`}>
                닫기
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
