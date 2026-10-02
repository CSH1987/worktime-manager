# worktime-backup (비공개 레포용 틀)

worktime-manager 운영 데이터를 매일 받아 두는 **비공개** 레포의 내용입니다.
worktime-manager 레포는 공개라서 백업은 반드시 이 비공개 레포에만 쌓습니다.

- 매일 03:00(KST) `backups/YYYY/MM/DD.json` 과 `latest.json` 이 커밋됩니다.
- 수동 실행: Actions → daily-backup → Run workflow
- 복구(worktime-manager 폴더에서):
  ```bash
  WORKTIME_EXPORT_TOKEN=... node scripts/restore.mjs latest.json          # 건수만 확인
  WORKTIME_EXPORT_TOKEN=... node scripts/restore.mjs latest.json --yes    # 실제 복구
  ```
