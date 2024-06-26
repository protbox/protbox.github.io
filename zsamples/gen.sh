#!/bin/bash

# Define the URL prefix
URL="https://insertable.github.io/website/zsamples"

# Iterate through all the files in the current folder
for file in *; do
  if [ -f "$file" ] && [ "$file" != "gen.sh" ]; then
    echo "$URL/$file"
  fi
done
