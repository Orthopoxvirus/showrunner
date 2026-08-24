#!/usr/bin/env bash
# Build showrunner, zip the standalone bundle and publish it as a release on a
# Gitea instance (tag = v<package.json version>).
#
# Required env:
#   GITEA_URL    e.g. https://gitea.example.com
#   GITEA_TOKEN  API token with repo scope
#   GITEA_REPO   owner/repo
# The data/ folder is always bundled into the zip. Releases live on a private
# Gitea, so shipping event content there is fine — but it means a release zip
# is NOT safe to share publicly as-is.
#
# Requires: node/npm, zip, curl, python3 (for JSON parsing).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${GITEA_URL:?set GITEA_URL, e.g. https://gitea.example.com}"
: "${GITEA_TOKEN:?set GITEA_TOKEN (api token)}"
: "${GITEA_REPO:?set GITEA_REPO, e.g. owner/showrunner}"

VERSION=$(node -p "require('./package.json').version")
TAG="v$VERSION"
ZIP="showrunner-$TAG-standalone.zip"
API="$GITEA_URL/api/v1/repos/$GITEA_REPO"
AUTH=(-H "Authorization: token $GITEA_TOKEN")

echo "==> building $TAG"
npm run build >/dev/null

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
mkdir "$STAGE/showrunner"
cp -r dist/. "$STAGE/showrunner/"
cat > "$STAGE/showrunner/README.txt" <<'EOF'
Showrunner — standalone bundle
==============================

DE: index.html in Chrome oder Edge öffnen (Doppelklick genügt), dann einmal
    den data-Ordner wählen (dieser Ordner enthält alle Anlässe, Backlogs und
    Songs — ein leerer Ordner geht auch). Danach läuft alles lokal im Browser.

EN: Open index.html in Chrome or Edge (double-click is fine), then pick the
    data folder once (it holds all events, backlogs and songs — an empty
    folder works too). Everything runs locally in the browser from there.

Firefox/Safari: not supported in standalone mode — use `npm run dev` instead.
EOF
echo "==> bundling data/ into the zip"
cp -r data "$STAGE/showrunner/data"
(cd "$STAGE" && zip -qr "$ZIP" showrunner)

echo "==> ensuring tag $TAG exists"
git tag -f "$TAG" >/dev/null
git push -q origin "refs/tags/$TAG" -f

echo "==> creating release $TAG"
# Release body = the matching CHANGELOG.md section (fallback: generic line).
BODY=$(awk -v tag="$TAG" '
  /^## /{ if (found) exit; if (index($0, "## " tag) == 1) { found = 1; next } }
  found { print }
' CHANGELOG.md)
[[ "$BODY" == *[![:space:]]* ]] || BODY="Standalone bundle: unzip, open index.html in Chrome/Edge, pick the data folder once."
STATUS=$(curl -s -o /tmp/release-resp.json -w '%{http_code}' "${AUTH[@]}" "$API/releases/tags/$TAG")
if [[ "$STATUS" == "404" ]]; then
  BODY="$BODY" python3 - "$TAG" <<'PYEOF' > /tmp/release-req.json
import json, os, sys
print(json.dumps({"tag_name": sys.argv[1], "name": f"Showrunner {sys.argv[1]}",
                  "body": os.environ["BODY"], "draft": False, "prerelease": False}))
PYEOF
  curl -s -o /tmp/release-resp.json "${AUTH[@]}" -H 'Content-Type: application/json' \
    -X POST "$API/releases" -d @/tmp/release-req.json
fi
RELEASE_ID=$(python3 -c "import json;print(json.load(open('/tmp/release-resp.json'))['id'])")

echo "==> uploading $ZIP (release id $RELEASE_ID)"
# replace an existing asset of the same name so re-runs converge
python3 - "$API" "$RELEASE_ID" "$ZIP" <<'PYEOF' | while read -r aid; do
import json, sys, urllib.request, os
api, rid, zipname = sys.argv[1], sys.argv[2], sys.argv[3]
req = urllib.request.Request(f"{api}/releases/{rid}/assets", headers={"Authorization": "token " + os.environ["GITEA_TOKEN"]})
for a in json.load(urllib.request.urlopen(req)):
    if a["name"] == zipname:
        print(a["id"])
PYEOF
  curl -s -o /dev/null "${AUTH[@]}" -X DELETE "$API/releases/$RELEASE_ID/assets/$aid"
done
curl -s -o /dev/null -w 'upload: %{http_code}\n' "${AUTH[@]}" \
  -X POST "$API/releases/$RELEASE_ID/assets?name=$ZIP" \
  -F "attachment=@$STAGE/$ZIP"

echo "==> done: $GITEA_URL/$GITEA_REPO/releases/tag/$TAG"
