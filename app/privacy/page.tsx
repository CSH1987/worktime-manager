// 개인정보 처리방침 — 구글 OAuth 앱 게시에 필요한 공개 페이지
export const metadata = { title: "개인정보 처리방침 · 근태·잔업 관리" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-sm leading-7 text-slate-700">
      <h1 className="mb-4 text-xl font-bold text-slate-900">개인정보 처리방침</h1>
      <p>이 앱은 한 팀이 근태·잔업 일정을 함께 보는 내부용 도구입니다.</p>
      <h2 className="mt-6 font-semibold text-slate-900">캘린더 연동 때 받는 정보</h2>
      <ul className="list-disc pl-5">
        <li>구글: 계정 이메일, 그리고 이 앱이 만든 &lsquo;팀 근태&rsquo; 캘린더에만 쓰는 권한(calendar.app.created). 개인 일정은 읽거나 고치지 않습니다.</li>
        <li>애플: Apple ID 와 사용자가 만든 앱 전용 암호.</li>
      </ul>
      <h2 className="mt-6 font-semibold text-slate-900">쓰는 곳과 보관</h2>
      <ul className="list-disc pl-5">
        <li>팀 일정(부재·잔업·패밀리데이)을 연결한 캘린더에 넣는 데만 씁니다. 광고·판매·제3자 제공은 하지 않습니다.</li>
        <li>자격증명은 암호화해 이 앱의 저장소(Netlify)에 보관하고, 화면이나 기록에 내보내지 않습니다.</li>
        <li>계정 이메일은 가려진 형태(예: ab***@gmail.com)로만 연결 목록에 보입니다.</li>
      </ul>
      <h2 className="mt-6 font-semibold text-slate-900">연결 해제·삭제</h2>
      <p>
        앱의 &lsquo;캘린더&rsquo; 창에서 해제하거나, 구글 계정 설정(보안 → 타사 앱 액세스)에서 권한을 없애면 저장된 자격증명은 쓸 수 없게 되고
        기록은 지워집니다. &lsquo;팀 근태&rsquo; 캘린더는 본인 계정에 남으며 직접 지울 수 있습니다.
      </p>
      <h2 className="mt-6 font-semibold text-slate-900">문의</h2>
      <p>choisooha87@gmail.com</p>
    </main>
  );
}
