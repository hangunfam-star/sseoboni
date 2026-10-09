# 써보니 실행 이미지(MWWork 서버: CentOS 7이라 최신 Node를 직접 못 돌려 Docker로 실행)
# 데이터는 이미지에 넣지 않는다: DB는 /data, 사진·설정은 /app/runtime-data에 서버 폴더를 붙인다.
FROM node:22-bullseye-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npx", "next", "start", "-H", "0.0.0.0", "-p", "3000"]
