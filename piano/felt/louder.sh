mkdir -p ogg_loud

for f in *.ogg; do
  ffmpeg -y -loglevel error -i "$f" \
    -filter:a "volume=2.5" \
    "ogg_loud/$(basename "$f")"
done
