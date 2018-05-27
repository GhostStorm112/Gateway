FROM node:10-alpine
LABEL maintainer "_112"
COPY ./ /app
# Add package.json for Yarn
#COPY package.json yarn.lock ./
CMD yarn test
WORKDIR /app
#  Install dependencies
RUN apk add --update \
&& apk add --no-cache ca-certificates \
&& apk add --no-cache --virtual .build-deps git python g++ make \
\
# Install node.js dependencies
&& yarn install \
\
# Clean up build dependencies
&& apk del .build-deps
CMD ["node", "./index.js"]
