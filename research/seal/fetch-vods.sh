#!/bin/bash
# Retry wrapper: Bilibili 412s the metadata endpoint intermittently.
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
ITEMS="${1:-74,25}"; HEIGHT="${2:-1080}"
mkdir -p "$(dirname "$0")/vods" && cd "$(dirname "$0")/vods"
for attempt in 1 2 3 4 5 6 7 8; do
  yt-dlp --cookies /tmp/bili_cookies.txt --user-agent "$UA" \
    --referer 'https://www.bilibili.com/video/BV1SxGM66ESZ' \
    --playlist-items "$ITEMS" \
    -f "bv*[height<=$HEIGHT][vcodec^=av01]+ba/bv*[height<=$HEIGHT][vcodec^=avc]+ba/b" \
    --merge-output-format mp4 --retries 20 --fragment-retries 20 --extractor-retries 5 \
    --sleep-requests 2 --continue --ignore-errors \
    -o '%(playlist_index)03d - %(title)s.%(ext)s' --no-progress --newline \
    'https://www.bilibili.com/video/BV1SxGM66ESZ' && break
  echo "== attempt $attempt failed, backing off ${attempt}0s =="; sleep ${attempt}0
done
