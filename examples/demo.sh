#!/bin/bash

cd $( dirname -- "$0"; )
mkdir -p ./dist && ln -fs ../../dist/Leaflet.ImagePdf.min.js  ./dist/Leaflet.ImagePdf.min.js
python3 -m http.server
