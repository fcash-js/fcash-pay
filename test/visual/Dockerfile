FROM circleci/node:9-browsers
USER root
COPY package.json /fcash-pay/package.json
COPY src/environments/dev.ts /fcash-pay/src/environments/dev.ts
WORKDIR /fcash-pay/
RUN npm install --unsafe-perm
COPY . /fcash-pay/
CMD [ "npm", "run", "e2e:capture-latest"]