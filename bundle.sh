npm install esbuild --save-dev
npx esbuild main.js --bundle --minify --outfile=./out/delib.min.js --format=esm --platform=browser