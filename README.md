# bunder

읽기 전용 파일 트리 로컬 앱. [barlo](https://github.com/cbcruk/barlo)로 이미 설치된 Chrome을 앱 창으로 띄우고, 파일시스템은 Bun 쪽에서 읽는다.

## 실행

```bash
pnpm install
pnpm start /보여줄/폴더      # 또는 EXPLORER_ROOT=/보여줄/폴더 pnpm start
pnpm compile                 # out/bunder 단일 실행 파일 (Node·node_modules 불필요, 로컬 Chrome 필요)
./out/bunder /보여줄/폴더
```

경로를 생략하면 현재 디렉터리가 루트가 된다.

## 구조

```
src/main.ts          Bun 진입점: Chrome 실행, UI 서빙, 브리지 함수 노출
src/bridge.types.ts  페이지에 노출되는 함수의 계약 (FinderBridge)
src/fs/              루트 검증(safe-resolve), 디렉터리 읽기(read-entries), 변경 감시(dir-watcher)
src/ui/              클라이언트 React. window.readDir()로 Bun을 호출
```

- **UI 서빙:** barlo의 `serveEmbedded`는 Bun의 `HTMLBundle`을 받지 못한다. 그래서 `Bun.serve({ routes })`가 `index.html`을 번들하고 barlo는 `serveOrigin`으로 그 서버를 프록시한다. 이 방식은 `bun build --compile`에서도 그대로 동작한다.
- **데이터:** 파일시스템 접근은 HTTP 핸들러가 아니라 `exposeFunction`(CDP 바인딩)으로만 한다. 결과는 JSON으로 오가므로 수정 시각은 ISO 문자열이다.
- **펼침 상태:** 열린 경로 집합을 React state로 관리한다. 폴더를 접으면 그 아래에서 열려 있던 경로도 함께 지운다. 디렉터리 목록은 경로별 promise로 캐시하고, `use()`와 폴더별 `Suspense`로 렌더한다.
- **변경 감지:** 펼쳐진 폴더만 Bun 쪽에서 `fs.watch`로 감시한다(재귀 아님, 참조 카운트). barlo에는 Bun에서 페이지로 보내는 통로가 없어서, 변경이 생기면 `app.evaluate`로 `window.onDirChanged(rel)`을 호출한다. 페이지는 그 경로의 캐시를 지우고 transition 안에서 다시 읽으므로 새 목록이 올 때까지 기존 목록이 그대로 보인다. 폴더를 접으면 감시를 해제하고 캐시도 버린다.

## 유지한 결정

- **`stat`이 아니라 `lstat`을 쓴다.** 심볼릭 링크를 따라가지 않으므로 순환 링크에 빠지지 않고, 링크를 링크로 표시할 수 있다.
- **경로 검증은 `realpath` 이후에 한다.** `path.resolve`만으로는 루트 안에 심어진 심볼릭 링크를 통한 탈출을 막지 못한다. `startsWith(root + sep)`로 구분자까지 비교해야 `/data-secret`이 `/data`의 하위로 오인되지 않는다.

## 알려진 한계

- **`lstat` N+1.** 디렉터리 하나당 항목 수만큼 `lstat`이 나간다. `MAX_ENTRIES`(500)가 상한이다.
- **barlo 브리지는 탭 단위다.** 페이지가 다른 origin으로 이동해도 노출 함수가 남는다. 이 앱은 외부 페이지를 열지 않는다는 전제에 기대고 있다. HTML 미리보기나 외부 링크를 추가하기 전에는 barlo 쪽에서 호출한 컨텍스트의 origin을 검사하도록 고쳐야 한다.
