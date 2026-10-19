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
src/main.ts                       Bun 진입점: Chrome 실행, UI 서빙, 브리지 함수 노출
src/bridge.types.ts               페이지에 노출되는 함수의 계약 (FinderBridge)
src/fs/                           루트 검증(safe-resolve), 목록·stat 읽기(read-entries, stat-entries),
                                  변경 감시(dir-watcher), 미리보기용 파일 판정(inspect-file, sniff)
src/set-input-files.ts            CDP DOM.setFileInputFiles로 페이지의 file input에 파일을 넣는다
src/ui/                           클라이언트 React. window.readDir()로 Bun을 호출
src/ui/components/tree/           트리와 키보드 탐색
src/ui/components/preview/        선택한 파일의 미리보기
src/ui/components/rendered-document/  HTML·Markdown 렌더링(sandbox iframe)
```

- **UI 서빙:** barlo의 `serveEmbedded`는 Bun의 `HTMLBundle`을 받지 못한다. 그래서 `Bun.serve({ routes })`가 `index.html`을 번들하고 barlo는 `serveOrigin`으로 그 서버를 프록시한다. 이 방식은 `bun build --compile`에서도 그대로 동작한다.
- **데이터:** 파일시스템 접근은 HTTP 핸들러가 아니라 `exposeFunction`(CDP 바인딩)으로만 한다. 결과는 JSON으로 오가므로 수정 시각은 ISO 문자열이다. barlo 0.1.2부터 앱 origin이 아닌 실행 컨텍스트(다른 곳으로 이동한 페이지, cross-origin iframe)의 호출은 실행되지 않는다.
- **펼침 상태:** 열린 경로 집합을 React state로 관리한다. 폴더를 접으면 그 아래에서 열려 있던 경로도 함께 지운다. 디렉터리 목록은 경로별 promise로 캐시하고, `use()`와 폴더별 `Suspense`로 렌더한다.
- **목록과 stat 분리:** `readDir`은 `Dirent`만으로 이름과 종류(dir/file/link)를 구한다. 크기와 수정 시각은 목록이 도착한 뒤 `statEntries`로 한 번에 요청하고, 행마다 `Suspense`로 채운다. 큰 디렉터리는 `PAGE_SIZE`(200)개씩 보여 주고 "Show more"로 늘린다. 정렬 때문에 `readdir`은 매번 전체를 읽지만, 브리지를 건너는 항목과 `lstat`은 보이는 만큼만이다.
- **선택과 키보드:** 행은 ARIA `treeitem`이고 roving `tabindex`를 쓴다. 클릭하거나 포커스를 옮기면 선택된다. 위/아래로 이동, Home/End로 처음과 끝, 오른쪽으로 펼치거나 안으로, 왼쪽으로 접거나 부모로, Enter/Space로 폴더를 토글한다. 선택을 품은 폴더를 접으면 선택이 그 폴더로 간다. 선택한 행이 사라지거나 다시 읽은 목록에서 페이지 밖으로 밀리면 선택이 부모 폴더로(루트 바로 아래면 해제) 옮겨 가고, 그때 포커스가 트리 안이나 `body`에 있었다면 포커스도 따라간다.
- **미리보기 데이터 경로:** 파일 내용은 브리지(JSON)로 보내지 않는다. 측정해 보니 100 MB에 58초가 걸렸고, 그동안 다른 호출도 막힌다. 페이지가 `provideFile(rel, inputId)`를 부르면 Bun이 `safeResolve`로 검증한 뒤 CDP `DOM.setFileInputFiles`로 그 input에 파일을 넣고, 페이지는 Chrome이 디스크에서 직접 읽는 `File`을 받는다. 지금은 barlo의 `Window.session`을 직접 쓴다(`src/set-input-files.ts`).
- **미리보기 표시:** 텍스트는 앞 256 KB만 읽는다. HTML·Markdown은 소스 보기가 기본이고 "Rendered"로 바꿀 수 있다. 부모 폴더에 변경이 생기면 다시 읽는다. Chrome이 넘긴 `File`은 파일이 바뀐 뒤에는 읽히지 않기 때문이다.
- **변경 감지:** 펼쳐진 폴더만 Bun 쪽에서 `fs.watch`로 감시한다(재귀 아님, 참조 카운트). barlo에는 Bun에서 페이지로 보내는 통로가 없어서, 변경이 생기면 `app.evaluate`로 `window.onDirChanged(rel)`을 호출한다. 페이지는 그 경로의 캐시를 지우고 transition 안에서 다시 읽으므로 새 목록이 올 때까지 기존 목록이 그대로 보인다. 폴더를 접으면 감시를 해제하고 캐시도 버린다.

## 유지한 결정

- **`stat`이 아니라 `lstat`을 쓴다.** 심볼릭 링크를 따라가지 않으므로 순환 링크에 빠지지 않고, 링크를 링크로 표시할 수 있다.
- **경로 검증은 `realpath` 이후에 한다.** `path.resolve`만으로는 루트 안에 심어진 심볼릭 링크를 통한 탈출을 막지 못한다. `startsWith(root + sep)`로 구분자까지 비교해야 `/data-secret`이 `/data`의 하위로 오인되지 않는다.
- **파일 종류는 이름이 아니라 앞부분 바이트로 판정한다.** `blob:` URL은 앱과 같은 origin이라, `.png`인 척하는 HTML이 iframe에 `text/html`로 들어가면 브리지를 쓸 수 있다. 그래서 Bun이 판정한 MIME(매직 바이트, SVG는 텍스트 시작 패턴)으로 blob을 다시 만든다(`file.slice(0, size, mime)`).
- **Blob URL은 이미지·PDF·영상·오디오에만 쓴다.** SVG는 `data:` URL로만 `<img>`에 넣고, 8 MB를 넘으면 텍스트로 보여 준다. "새 탭에서 이미지 열기"로 열렸을 때 blob SVG는 앱 origin에서 스크립트를 실행하지만, `data:` 문서는 origin이 불투명하다.
- **HTML·Markdown 렌더링은 세 겹으로 막는다.**
  1. DOMPurify(허용 목록)로 스크립트와 이벤트 핸들러를 지운다. 추가로 `<link>`·`<base>`·`<meta>`, 프레임·`<object>`·`<embed>`, SVG 애니메이션 요소, 그리고 `href`·`xlink:href`·`target`·`ping`·`action`·`formaction`·`srcset` 속성도 지운다. 링크 주소는 `title` 툴팁으로 남긴다.
  2. 네트워크를 전부 막는 CSP를 `<head>` 맨 앞에 넣는다.
  3. `sandbox=""` + `srcdoc` iframe으로 보여 준다. origin이 불투명하고 스크립트가 돌지 않는다.

  CSP와 sandbox는 링크 클릭 이동, Cmd·가운데 클릭으로 여는 새 탭, `preconnect`를 막지 못한다. 그래서 1단계가 필요하다.

## 알려진 한계

- **렌더링한 문서의 상대 경로 리소스는 보이지 않는다.** 같은 폴더의 이미지 등은 CSP에 막힌다.
- **렌더링한 문서는 프레임 안에서 가짜 UI를 그릴 수 있다.** 자체 `<style>`은 남기 때문이다. 다만 테두리 밖으로 나오거나 어디로 무언가를 보낼 수는 없다.
- **가상 스크롤 없음.** "Show more"로 늘린 행은 모두 DOM에 남는다. 폴더에 변경이 생기면 보이는 항목 전체의 `lstat`을 다시 요청한다.
