FROM node:10.11.0-alpine
LABEL name "Ghost-Gateway"
LABEL maintainer "_112"
COPY ./ /app
# Add package.json for Yarn
#COPY package.json yarn.lock ./
CMD npm test
WORKDIR /app
#  Install dependencies
RUN apk add --update \
&& apk add --no-cache ca-certificates \
&& apk add --no-cache --virtual .build-deps git python g++ make \
\
# Install node.js dependencies
&& npm install \
\
# Clean up build dependencies
&& apk del .build-deps
CMD ["node", "./index.js"]