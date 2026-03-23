scp robug@list.robug.com:/tmp/comptool.tar.gz ~/
cd ~
tar xzf comptool.tar.gz
cd comptool
cp .env.example .env   # edit with your local DB credentials
npm install
npx playwright install chromium
npx prisma db push
cd client && npm install && cd ..
