FROM circleci/node:9-browsers
USER root
COPY package.json /fcashpay/package.json
COPY src/environments/dev.ts /fcashpay/src/environments/dev.ts
WORKDIR /fcashpay/
RUN npm install --unsafe-perm
COPY . /fcashpay/
CMD [ "npm", "run", "e2e:capture-latest"]