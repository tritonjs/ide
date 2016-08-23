FROM mhart/alpine-node:6.3.0

# Add our files & set working dir
ADD . /ide
WORKDIR /ide

# native modules.
RUN apk add --update --no-cache make gcc g++ python

RUN npm install
RUN npm install -g nodemon

# Environment variables
ENV DEBUG *,-nodemon:*,-nodemon,-express:*,-ioredis:*
ENV DEBUG_COLORS 1
ENV TERM xterm

EXPOSE 80

CMD ["nodemon", "npm", "start"]
